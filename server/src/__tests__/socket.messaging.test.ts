import { createServer, type Server as HttpServer } from 'node:http';
import express from 'express';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSocketServer } from '../infrastructure/realtime/socket-server';
import { env } from '../config/env';
import { conversationsRepository } from '../modules/conversations/conversations.repository';
import { messagesRepository } from '../modules/messages/messages.repository';
import { eventBus } from '../infrastructure/events/event-bus';
import prisma from '../infrastructure/database/prisma';

const token = (userId: string) => jwt.sign({ sub: userId, email: `${userId}@example.com`, role: 'USER', status: 'ACTIVE', type: 'access' }, env.jwtAccessSecret);

const waitFor = (socket: ClientSocket, event: string) => new Promise<unknown>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 1000);
  socket.once(event, (value) => { clearTimeout(timer); resolve(value); });
});

const waitForConnect = (socket: ClientSocket) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out waiting for connect')), 1000);
  socket.once('connect', () => { clearTimeout(timer); resolve(); });
  socket.once('connect_error', (error) => { clearTimeout(timer); reject(new Error(`connect_error: ${(error as Error).message}`)); });
});

let server: HttpServer | undefined;
let socketServer: ReturnType<typeof createSocketServer> | undefined;
let clients: ClientSocket[] = [];

afterEach(async () => {
  clients.forEach((client) => client.close());
  clients = [];
  socketServer?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
  socketServer = undefined;
  server = undefined;
  vi.restoreAllMocks();
});

const start = async () => {
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ status: 'ACTIVE', isRestricted: false } as never);
  server = createServer(express());
  socketServer = createSocketServer(server);
  await new Promise<void>((resolve) => server?.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
};

describe('Socket.IO messaging', () => {
  it('rejects unauthenticated connections', async () => {
    const url = await start();
    const client = createClient(url, { autoConnect: false, reconnection: false });
    clients.push(client);
    const error = waitFor(client, 'connect_error');
    client.connect();
    expect((await error as Error).message).toBe('UNAUTHORIZED');
  });

  it('rejects unauthorized room joins and permits authorized participants', async () => {
    const url = await start();
    vi.spyOn(conversationsRepository, 'getById').mockResolvedValue({ id: 'conversation_1', requestId: 'request_1', userAId: 'user_a', userBId: 'user_b', createdAt: new Date(), updatedAt: new Date(), userA: { id: 'user_a', name: 'Alice' }, userB: { id: 'user_b', name: 'Bob' }, request: { id: 'request_1', status: 'ACCEPTED', skillId: 'skill_1', skill: { id: 'skill_1', title: 'Java' } } } as never);
    const client = createClient(url, { auth: { token: token('user_c') }, autoConnect: false, reconnection: false });
    clients.push(client);
    const connected = waitForConnect(client);
    client.connect();
    await connected;
    const error = waitFor(client, 'error');
    client.emit('conversation:join', 'conversation_1', () => undefined);
    expect(await error).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('persists through the message service before broadcasting', async () => {
    const url = await start();
    vi.spyOn(conversationsRepository, 'getById').mockResolvedValue({ id: 'conversation_1', requestId: 'request_1', userAId: 'user_a', userBId: 'user_b', createdAt: new Date(), updatedAt: new Date(), userA: { id: 'user_a', name: 'Alice' }, userB: { id: 'user_b', name: 'Bob' }, request: { id: 'request_1', status: 'ACCEPTED', skillId: 'skill_1', skill: { id: 'skill_1', title: 'Java' } } } as never);
    vi.spyOn(messagesRepository, 'findAuthorizedConversation').mockResolvedValue({ id: 'conversation_1', userAId: 'user_a', userBId: 'user_b' });
    const create = vi.spyOn(messagesRepository, 'create').mockResolvedValue({ id: 'message_1', conversationId: 'conversation_1', senderId: 'user_a', content: 'Hello', createdAt: new Date(), editedAt: null, deletedAt: null, readAt: null, sender: { id: 'user_a', name: 'Alice' } } as never);
    const sender = createClient(url, { auth: { token: token('user_a') }, autoConnect: false, reconnection: false });
    const receiver = createClient(url, { auth: { token: token('user_b') }, autoConnect: false, reconnection: false });
    clients.push(sender, receiver);
    const senderConnected = waitForConnect(sender);
    const receiverConnected = waitForConnect(receiver);
    sender.connect();
    receiver.connect();
    await Promise.all([senderConnected, receiverConnected]);
    await Promise.all([
      new Promise<void>((resolve) => sender.emit('conversation:join', 'conversation_1', () => resolve())),
      new Promise<void>((resolve) => receiver.emit('conversation:join', 'conversation_1', () => resolve())),
    ]);
    const received = waitFor(receiver, 'message:received');
    sender.emit('message:send', { conversationId: 'conversation_1', content: 'Hello' });
    expect(await received).toMatchObject({ messageId: 'message_1', conversationId: 'conversation_1' });
    expect(create).toHaveBeenCalledWith({ conversationId: 'conversation_1', senderId: 'user_a', content: 'Hello' });
  });

  it('rejects operations after a participant becomes restricted', async () => {
    const url = await start();
    let active = true;
    (vi.spyOn(prisma.user, 'findUnique') as any).mockImplementation(async () => ({ status: active ? 'ACTIVE' : 'SUSPENDED', isRestricted: false }));
    vi.spyOn(conversationsRepository, 'getById').mockResolvedValue({ id: 'conversation_1', requestId: 'request_1', userAId: 'user_a', userBId: 'user_b', createdAt: new Date(), updatedAt: new Date(), userA: { id: 'user_a', name: 'Alice' }, userB: { id: 'user_b', name: 'Bob' }, request: { id: 'request_1', status: 'ACCEPTED', skillId: 'skill_1', skill: { id: 'skill_1', title: 'Java' } } } as never);
    const sender = createClient(url, { auth: { token: token('user_a') }, autoConnect: false, reconnection: false });
    clients.push(sender);
    const connected = waitForConnect(sender);
    sender.connect();
    await connected;
    await new Promise<void>((resolve) => sender.emit('conversation:join', 'conversation_1', () => resolve()));
    active = false;

    const error = waitFor(sender, 'error');
    sender.emit('message:send', { conversationId: 'conversation_1', content: 'Should be rejected' });
    expect(await error).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('scopes conversation-created events to the accepted request participants', async () => {
    const url = await start();
    const participant = createClient(url, { auth: { token: token('user_a') }, autoConnect: false, reconnection: false });
    const outsider = createClient(url, { auth: { token: token('user_c') }, autoConnect: false, reconnection: false });
    clients.push(participant, outsider);
    const participantConnected = waitForConnect(participant);
    const outsiderConnected = waitForConnect(outsider);
    participant.connect();
    outsider.connect();
    await Promise.all([participantConnected, outsiderConnected]);

    const participantEvent = waitFor(participant, 'conversation:created');
    let outsiderReceived = false;
    outsider.once('conversation:created', () => { outsiderReceived = true; });
    await eventBus.publish('request.accepted', { requestId: 'request_1', senderId: 'user_a', receiverId: 'user_b', skillId: 'skill_1', status: 'ACCEPTED', previousStatus: 'PENDING', actorUserId: 'user_b' });
    expect(await participantEvent).toMatchObject({ requestId: 'request_1', senderId: 'user_a', receiverId: 'user_b' });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(outsiderReceived).toBe(false);
  });
});
