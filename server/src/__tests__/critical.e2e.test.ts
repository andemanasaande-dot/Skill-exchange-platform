import express from 'express';
import { createServer, type Server as HttpServer } from 'node:http';
import request from 'supertest';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuthRouter } from '../modules/auth/routes';
import { createUsersRouter } from '../modules/users/routes';
import { createSkillsRouter } from '../modules/skills/routes';
import { createRequestsRouter } from '../modules/requests/routes';
import { createConversationsRouter } from '../modules/conversations/routes';
import { createMessagesRouter } from '../modules/messages/routes';
import { createNotificationsRouter } from '../modules/notifications/routes';
import { createRecommendationsRouter } from '../modules/recommendations/routes';
import { authService } from '../modules/auth/auth.service';
import { usersRepository } from '../modules/users/users.repository';
import { skillsRepository } from '../modules/skills/skills.repository';
import { interestsRepository } from '../modules/users/interests.repository';
import { requestsRepository } from '../modules/requests/requests.repository';
import { reviewsRepository } from '../modules/requests/reviews.repository';
import { conversationsRepository } from '../modules/conversations/conversations.repository';
import { messagesRepository } from '../modules/messages/messages.repository';
import { notificationsRepository } from '../modules/notifications/notifications.repository';
import { recommendationsRepository } from '../modules/recommendations/recommendations.repository';
import { createSocketServer } from '../infrastructure/realtime/socket-server';
import { auditService } from '../infrastructure/audit/audit.service';
import prisma from '../infrastructure/database/prisma';
import { env } from '../config/env';
import jwt from 'jsonwebtoken';

const users = {
  user_a: { id: 'user_a', name: 'Alice Rivera', email: 'alice@example.com', role: 'USER', status: 'ACTIVE' },
  user_b: { id: 'user_b', name: 'Bob Chen', email: 'bob@example.com', role: 'USER', status: 'ACTIVE' },
  user_x: { id: 'user_x', name: 'Eve Outsider', email: 'eve@example.com', role: 'USER', status: 'ACTIVE' },
};
const requestRecord = { id: 'request_1', senderId: 'user_a', receiverId: 'user_b', skillId: 'skill_photoshop', status: 'PENDING', message: 'I would love to learn Photoshop.', sender: { id: 'user_a', name: users.user_a.name }, receiver: { id: 'user_b', name: users.user_b.name }, skill: { id: 'skill_photoshop', title: 'Photoshop', isActive: true, category: { id: 'design', name: 'Design', slug: 'design' } }, createdAt: new Date(), updatedAt: new Date() };
const conversation = { id: 'conversation_1', requestId: 'request_1', userAId: 'user_a', userBId: 'user_b', createdAt: new Date(), updatedAt: new Date(), userA: { id: 'user_a', name: users.user_a.name }, userB: { id: 'user_b', name: users.user_b.name }, request: { id: 'request_1', status: 'ACCEPTED', skillId: 'skill_photoshop', skill: { id: 'skill_photoshop', title: 'Photoshop' } } };
const accessToken = (userId: string) => jwt.sign({ sub: userId, email: users[userId as 'user_a' | 'user_b'].email, role: 'USER', status: 'ACTIVE', type: 'access' }, env.jwtAccessSecret);
const socketEvent = (socket: Socket, event: string) => new Promise<unknown>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 1000);
  socket.once(event, (payload) => { clearTimeout(timeout); resolve(payload); });
});

let httpServer: HttpServer | undefined;
let socketServer: ReturnType<typeof createSocketServer> | undefined;
let sockets: Socket[] = [];

afterEach(async () => {
  sockets.forEach((socket) => socket.close());
  sockets = [];
  socketServer?.close();
  await new Promise<void>((resolve) => httpServer?.close(() => resolve()) ?? resolve());
  httpServer = undefined;
  socketServer = undefined;
  vi.restoreAllMocks();
});

const userMiddleware = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const userId = req.headers['x-user-id'];
  if (typeof userId === 'string' && users[userId as 'user_a' | 'user_b' | 'user_x']) (req as any).user = users[userId as 'user_a' | 'user_b' | 'user_x'];
  next();
};

const createJourneyApp = () => {
  const app = express();
  app.use(express.json());
  app.use(userMiddleware);
  app.use('/api/v1/auth', createAuthRouter());
  app.use('/api/v1', createUsersRouter());
  app.use('/api/v1/skills', createSkillsRouter());
  app.use('/api/v1/requests', createRequestsRouter());
  app.use('/api/v1/conversations', createConversationsRouter());
  app.use('/api/v1/conversations', createMessagesRouter());
  app.use('/api/v1/messages', createMessagesRouter());
  app.use('/api/v1/notifications', createNotificationsRouter());
  app.use('/api/v1/recommendations', createRecommendationsRouter());
  return app;
};

describe('critical SkillSwap journey', () => {
  it('completes the reciprocal exchange journey and blocks unauthorized access', async () => {
    const app = createJourneyApp();
    vi.spyOn(authService, 'registerUser').mockImplementation(async ({ name, email }) => ({ id: email.startsWith('alice') ? 'user_a' : 'user_b', name, email, role: 'USER', status: 'ACTIVE', emailVerified: false, avatarUrl: null, bio: null } as never));
    vi.spyOn(authService, 'verifyEmailAddress').mockImplementation(async ({ token }) => ({ verified: true, email: token.includes('alice') ? users.user_a.email : users.user_b.email }));
    vi.spyOn(authService, 'loginUser').mockImplementation(async ({ email }) => ({ accessToken: accessToken(email.startsWith('alice') ? 'user_a' : 'user_b'), refreshToken: `refresh_${email}`, user: { ...users[email.startsWith('alice') ? 'user_a' : 'user_b'], emailVerified: true } } as never));
    vi.spyOn(auditService, 'record').mockResolvedValue({ id: 'audit_1' } as never);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ status: 'ACTIVE', isRestricted: false } as never);
    vi.spyOn(usersRepository, 'findById').mockResolvedValue({ ...users.user_a, bio: 'Java developer', location: 'Seattle', avatarUrl: null, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } as never);
    vi.spyOn(usersRepository, 'findPublicProfileById').mockResolvedValue({ id: 'user_b', name: users.user_b.name, bio: 'Design mentor', location: 'Toronto', avatarUrl: null, createdAt: new Date(), updatedAt: new Date() } as never);
    vi.spyOn(usersRepository, 'updateProfile').mockResolvedValue({ ...users.user_a, bio: 'Java developer', location: 'Seattle', avatarUrl: null, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } as never);
    vi.spyOn(skillsRepository, 'create').mockImplementation(async (payload) => ({ id: payload.title === 'Java' ? 'skill_java' : 'skill_photoshop', ...payload, createdAt: new Date(), updatedAt: new Date() } as never));
    vi.spyOn(interestsRepository, 'findSkill').mockImplementation(async (skillId) => (skillId === 'skill_photoshop'
      ? { id: 'skill_photoshop', title: 'Photoshop', description: null, isActive: true, category: null }
      : { id: 'skill_java', title: 'Java', description: null, isActive: true, category: null }) as never);
    vi.spyOn(interestsRepository, 'findByUserAndSkill').mockResolvedValue(null);
    vi.spyOn(interestsRepository, 'create').mockImplementation(async (_userId, skillId) => ({ id: 'interest_1', skillId, interestType: 'LEARN', skill: { id: skillId, title: skillId === 'skill_photoshop' ? 'Photoshop' : 'Java', isActive: true } } as never));
    vi.spyOn(recommendationsRepository, 'findUserWithActiveSkillsAndInterests').mockResolvedValue({ id: 'user_a', name: users.user_a.name, status: 'ACTIVE', skills: [{ id: 'skill_java', title: 'Java', categoryId: 'programming' }], skillInterests: [{ skillId: 'skill_photoshop', interestType: 'LEARN', skill: { id: 'skill_photoshop', title: 'Photoshop', categoryId: 'design' } }] } as never);
    vi.spyOn(recommendationsRepository, 'findActiveUsersWithActiveSkillsAndInterests').mockResolvedValue([{ id: 'user_b', name: users.user_b.name, status: 'ACTIVE', skills: [{ id: 'skill_photoshop', title: 'Photoshop', categoryId: 'design' }], skillInterests: [{ skillId: 'skill_java', interestType: 'LEARN', skill: { id: 'skill_java', title: 'Java', categoryId: 'programming' } }] }] as never);
    vi.spyOn(requestsRepository, 'create').mockResolvedValue(requestRecord as never);
    vi.spyOn(requestsRepository, 'findById')
      .mockResolvedValueOnce(requestRecord as never)
      .mockResolvedValueOnce({ ...requestRecord, status: 'ACCEPTED' } as never)
      .mockResolvedValueOnce({ ...requestRecord, status: 'COMPLETED' } as never);
    vi.spyOn(requestsRepository, 'transition')
      .mockResolvedValueOnce({ ...requestRecord, status: 'ACCEPTED' } as never)
      .mockResolvedValueOnce({ ...requestRecord, status: 'COMPLETED' } as never);
    vi.spyOn(reviewsRepository, 'create').mockResolvedValue({ id: 'review_1', requestId: 'request_1', authorId: 'user_a', recipientId: 'user_b', rating: 5, comment: 'Great exchange.', createdAt: new Date(), updatedAt: new Date() } as never);
    vi.spyOn(notificationsRepository, 'listByUser').mockResolvedValue({ notifications: [{ id: 'notification_1', recipientId: 'user_b', type: 'REQUEST_CREATED', title: 'New request', body: 'Alice sent a request.', isRead: false, createdAt: new Date(), updatedAt: new Date() }], total: 1 } as never);
    vi.spyOn(conversationsRepository, 'getById').mockResolvedValue(conversation as never);
    vi.spyOn(conversationsRepository, 'listByUser').mockResolvedValue([conversation] as never);
    (vi.spyOn(messagesRepository, 'findAuthorizedConversation') as any).mockImplementation(async (_conversationId: string, userId: string) => userId === 'user_x' ? null : { id: conversation.id, userAId: 'user_a', userBId: 'user_b' });
    vi.spyOn(messagesRepository, 'create').mockResolvedValue({ id: 'message_1', conversationId: conversation.id, senderId: 'user_a', content: 'Ready to learn.', createdAt: new Date(), editedAt: null, deletedAt: null, readAt: null, sender: { id: 'user_a', name: users.user_a.name } } as never);
    httpServer = createServer(express());
    socketServer = createSocketServer(httpServer);
    await new Promise<void>((resolve) => httpServer?.listen(0, resolve));
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const receiverSocket = connectSocket(`http://127.0.0.1:${port}`, { auth: { token: accessToken('user_b') }, reconnection: false });
    sockets.push(receiverSocket);
    await socketEvent(receiverSocket, 'connect');
    await new Promise<void>((resolve) => receiverSocket.emit('conversation:join', conversation.id, (result: { ok: boolean }) => result.ok ? resolve() : resolve()));

    expect((await request(app).post('/api/v1/auth/register').send({ name: users.user_a.name, email: users.user_a.email, password: 'StrongP@ssw0rd123' })).status).toBe(201);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token: 'alice-verification-token' })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ email: users.user_a.email, password: 'StrongP@ssw0rd123' })).status).toBe(200);
    const profileResponse = await request(app).put('/api/v1/profile').set('x-user-id', 'user_a').send({ bio: 'Java developer', location: 'Seattle' });
    expect(profileResponse.status).toBe(200);
    expect((await request(app).post('/api/v1/skills').set('x-user-id', 'user_a').send({ title: 'Java', categoryId: 'programming' })).status).toBe(201);
    expect((await request(app).post('/api/v1/profile/interests').set('x-user-id', 'user_a').send({ skillId: 'skill_photoshop' })).status).toBe(201);
    expect((await request(app).post('/api/v1/auth/register').send({ name: users.user_b.name, email: users.user_b.email, password: 'StrongP@ssw0rd123' })).status).toBe(201);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token: 'bob-verification-token' })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ email: users.user_b.email, password: 'StrongP@ssw0rd123' })).status).toBe(200);
    expect((await request(app).put('/api/v1/profile').set('x-user-id', 'user_b').send({ bio: 'Design mentor' })).status).toBe(200);
    expect((await request(app).post('/api/v1/skills').set('x-user-id', 'user_b').send({ title: 'Photoshop', categoryId: 'design' })).status).toBe(201);
    expect((await request(app).post('/api/v1/profile/interests').set('x-user-id', 'user_b').send({ skillId: 'skill_java' })).status).toBe(201);
    expect((await request(app).post('/api/v1/recommendations/users').set('x-user-id', 'user_a')).status).toBe(404);
    const discoveries = await request(app).get('/api/v1/recommendations/users').set('x-user-id', 'user_a');
    expect(discoveries.status).toBe(200);
    expect(discoveries.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ user: expect.objectContaining({ id: 'user_b', name: users.user_b.name }) })]));
    const publicProfile = await request(app).get('/api/v1/users/user_b').set('x-user-id', 'user_a');
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.data.user).toMatchObject({ id: 'user_b', name: users.user_b.name, bio: 'Design mentor' });
    const exchangeRequest = await request(app).post('/api/v1/requests').set('x-user-id', 'user_a').send({ receiverId: 'user_b', skillId: 'skill_photoshop', message: 'I would love to learn Photoshop.' });
    expect(exchangeRequest.status).toBe(201);
    const notificationResponse = await request(app).get('/api/v1/notifications').set('x-user-id', 'user_b');
    expect(notificationResponse.status).toBe(200);
    expect(notificationResponse.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ recipientId: 'user_b', type: 'REQUEST_CREATED' })]));
    expect((await request(app).put('/api/v1/requests/request_1/accept').set('x-user-id', 'user_b')).status).toBe(200);
    expect((await request(app).get('/api/v1/conversations').set('x-user-id', 'user_a')).status).toBe(200);
    expect((await request(app).get('/api/v1/conversations/conversation_1').set('x-user-id', 'user_a')).status).toBe(200);
    const receivedMessage = socketEvent(receiverSocket, 'message:received');
    expect((await request(app).post('/api/v1/conversations/conversation_1/messages').set('x-user-id', 'user_a').send({ content: 'Ready to learn.' })).status).toBe(201);
    expect(await receivedMessage).toMatchObject({ messageId: 'message_1', conversationId: conversation.id, content: 'Ready to learn.' });
    const completion = await request(app).put('/api/v1/requests/request_1/complete').set('x-user-id', 'user_b');
    expect(completion.status).toBe(200);
    const review = await request(app).post('/api/v1/requests/request_1/review').set('x-user-id', 'user_a').send({ rating: 5, comment: 'Great exchange.' });
    expect(review.status).toBe(201);
    expect((await request(app).get('/api/v1/conversations/conversation_1')).status).toBe(401);
    expect((await request(app).get('/api/v1/conversations/conversation_1').set('x-user-id', 'user_x')).status).toBe(403);
    expect((await request(app).get('/api/v1/conversations/conversation_1/messages').set('x-user-id', 'user_x')).status).toBe(403);
  });
});
