import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMessagesRouter, createMessageReadRouter } from '../modules/messages/routes';
import { messagesRepository } from '../modules/messages/messages.repository';

const createApp = (userId = 'user_a') => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { id: userId, email: `${userId}@example.com` }; next(); });
  app.use('/api/v1/conversations', createMessagesRouter());
  app.use('/api/v1/messages', createMessageReadRouter());
  return app;
};

const message = (overrides = {}) => ({
  id: 'message_1', conversationId: 'conversation_1', senderId: 'user_a', content: 'Hello',
  createdAt: new Date(), editedAt: null, deletedAt: null, readAt: null, sender: { id: 'user_a', name: 'Alice' }, ...overrides,
});

describe('REST messaging layer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists authorized conversation messages with pagination', async () => {
    const authorized = vi.spyOn(messagesRepository, 'findAuthorizedConversation').mockResolvedValue({ id: 'conversation_1', userAId: 'user_a', userBId: 'user_b' });
    vi.spyOn(messagesRepository, 'listByConversation').mockResolvedValue({ messages: [message()], total: 3 } as never);

    const response = await request(createApp()).get('/api/v1/conversations/conversation_1/messages?page=2&limit=1');

    expect(response.status).toBe(200);
    expect(authorized).toHaveBeenCalledWith('conversation_1', 'user_a');
    expect(response.body.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
    expect(response.body.data[0].content).toBe('Hello');
  });

  it('never lists or creates messages for unauthorized conversations', async () => {
    vi.spyOn(messagesRepository, 'findAuthorizedConversation').mockResolvedValue(null);
    const listByConversation = vi.spyOn(messagesRepository, 'listByConversation');
    const createSpy = vi.spyOn(messagesRepository, 'create');

    const list = await request(createApp('user_c')).get('/api/v1/conversations/conversation_1/messages');
    const create = await request(createApp('user_c')).post('/api/v1/conversations/conversation_1/messages').send({ content: 'Secret' });

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
    expect(listByConversation).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('persists an authorized message and publishes through the service boundary', async () => {
    vi.spyOn(messagesRepository, 'findAuthorizedConversation').mockResolvedValue({ id: 'conversation_1', userAId: 'user_a', userBId: 'user_b' });
    vi.spyOn(messagesRepository, 'create').mockResolvedValue(message() as never);

    const response = await request(createApp()).post('/api/v1/conversations/conversation_1/messages').send({ content: 'A useful message' });

    expect(response.status).toBe(201);
    expect(messagesRepository.create).toHaveBeenCalledWith({ conversationId: 'conversation_1', senderId: 'user_a', content: 'A useful message' });
  });

  it('rejects invalid content and scopes read acknowledgment to the participant', async () => {
    const invalid = await request(createApp()).post('/api/v1/conversations/conversation_1/messages').send({ content: '   ' });
    const markRead = vi.spyOn(messagesRepository, 'markRead').mockResolvedValue(undefined);
    const read = await request(createApp('user_b')).put('/api/v1/messages/message_1/read');

    expect(invalid.status).toBe(400);
    expect(read.status).toBe(200);
    expect(markRead).toHaveBeenCalledWith('message_1', 'user_b');
  });
});
