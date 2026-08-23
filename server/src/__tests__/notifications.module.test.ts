import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNotificationsRouter } from '../modules/notifications/routes';
import { notificationsRepository } from '../modules/notifications/notifications.repository';
import { notificationsService } from '../modules/notifications/notifications.service';

const createApp = () => {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { id: 'user_1', email: 'alice@example.com', role: 'USER', status: 'ACTIVE' };
    next();
  });
  app.use('/api/v1/notifications', createNotificationsRouter());
  return app;
};

describe('notifications module', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists only the authenticated user notifications with pagination', async () => {
    const createdAt = new Date('2026-01-02');
    vi.spyOn(notificationsRepository, 'listByUser').mockResolvedValue({
      notifications: [{ id: 'notification_1', recipientId: 'user_1', type: 'REQUEST_CREATED', title: 'New request', body: 'A request', isRead: false, createdAt, updatedAt: createdAt }],
      total: 3,
    } as never);

    const response = await request(createApp()).get('/api/v1/notifications?page=2&limit=1');

    expect(response.status).toBe(200);
    expect(notificationsRepository.listByUser).toHaveBeenCalledWith('user_1', 2, 1);
    expect(response.body.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
  });

  it('returns unread count and marks notifications read only for the owner', async () => {
    vi.spyOn(notificationsRepository, 'unreadCount').mockResolvedValue(4);
    const markRead = vi.spyOn(notificationsRepository, 'markRead').mockResolvedValue(undefined);
    const markAllRead = vi.spyOn(notificationsRepository, 'markAllRead').mockResolvedValue({ count: 2 } as never);

    const count = await request(createApp()).get('/api/v1/notifications/unread-count');
    const read = await request(createApp()).put('/api/v1/notifications/notification_1/read');
    const all = await request(createApp()).put('/api/v1/notifications/read-all');

    expect(count.body.data.count).toBe(4);
    expect(read.status).toBe(200);
    expect(all.body.data.updated).toBe(2);
    expect(markRead).toHaveBeenCalledWith('user_1', 'notification_1');
    expect(markAllRead).toHaveBeenCalledWith('user_1');
  });

  it('rejects invalid pagination parameters', async () => {
    const zeroPage = await request(createApp()).get('/api/v1/notifications?page=0');
    const excessiveLimit = await request(createApp()).get('/api/v1/notifications?limit=101');

    expect(zeroPage.status).toBe(400);
    expect(excessiveLimit.status).toBe(400);
  });

  it('creates notifications through event templates rather than controllers', async () => {
    const create = vi.spyOn(notificationsRepository, 'create').mockResolvedValue({ id: 'notification_1' } as never);

    await notificationsService.handleEvent({
      type: 'request.accepted',
      occurredAt: new Date().toISOString(),
      payload: { requestId: 'request_1', senderId: 'user_1', receiverId: 'user_2', skillId: 'skill_1', status: 'ACCEPTED', actorUserId: 'user_2', previousStatus: 'PENDING' },
    });

    expect(create).toHaveBeenCalledWith({
      recipientId: 'user_1', type: 'REQUEST_ACCEPTED', title: 'Request accepted', body: 'Your skill exchange request was accepted.',
    });
  });
});
