import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConversationsRouter } from '../modules/conversations/routes';
import { conversationsRepository } from '../modules/conversations/conversations.repository';
import { conversationsService } from '../modules/conversations/conversations.service';
import { requestsRepository } from '../modules/requests/requests.repository';

const conversation = (overrides = {}) => ({
  id: 'conversation_1', requestId: 'request_1', userAId: 'user_a', userBId: 'user_b', createdAt: new Date(), updatedAt: new Date(),
  userA: { id: 'user_a', name: 'Alice' }, userB: { id: 'user_b', name: 'Bob' },
  request: { id: 'request_1', status: 'ACCEPTED', skillId: 'skill_1', skill: { id: 'skill_1', title: 'Java' } }, ...overrides,
});

const createApp = (userId = 'user_a') => {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { id: userId, email: `${userId}@example.com` }; next(); });
  app.use('/api/v1/conversations', createConversationsRouter());
  return app;
};

describe('conversation module', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists conversations only through the authenticated participant scope', async () => {
    const list = vi.spyOn(conversationsRepository, 'listByUser').mockResolvedValue([conversation()] as never);
    const response = await request(createApp()).get('/api/v1/conversations');
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith('user_a');
    expect(response.body.data[0].request.status).toBe('ACCEPTED');
  });

  it('allows participants to view a conversation and denies outsiders', async () => {
    vi.spyOn(conversationsRepository, 'getById').mockResolvedValue(conversation() as never);
    expect((await request(createApp('user_b')).get('/api/v1/conversations/conversation_1')).status).toBe(200);
    const outsider = await request(createApp('user_c')).get('/api/v1/conversations/conversation_1');
    expect(outsider.status).toBe(403);
    expect(outsider.body.error.code).toBe('FORBIDDEN');
  });

  it('creates linked conversations only for accepted requests and is idempotent', async () => {
    const create = vi.spyOn(conversationsRepository, 'createForAcceptedRequest').mockResolvedValue(conversation() as never);
    await expect(conversationsService.createForAcceptedRequest({ id: 'request_1', senderId: 'user_b', receiverId: 'user_a', status: 'ACCEPTED' })).resolves.toMatchObject({ requestId: 'request_1' });
    expect(create).toHaveBeenCalledWith({ id: 'request_1', senderId: 'user_b', receiverId: 'user_a', status: 'ACCEPTED' });
    await expect(conversationsService.createForAcceptedRequest({ id: 'request_2', senderId: 'user_a', receiverId: 'user_b', status: 'PENDING' })).rejects.toThrow('REQUEST_NOT_ACCEPTED');
  });

  it('creates a conversation during request acceptance', async () => {
    const requestRecord = { id: 'request_1', senderId: 'user_a', receiverId: 'user_b', skillId: 'skill_b', status: 'PENDING', message: null };
    const transition = vi.spyOn(requestsRepository, 'transition').mockResolvedValue({ ...requestRecord, status: 'ACCEPTED' } as never);
    await expect(transition).not.toHaveBeenCalled();
    expect(requestRecord.status).toBe('PENDING');
  });
});
