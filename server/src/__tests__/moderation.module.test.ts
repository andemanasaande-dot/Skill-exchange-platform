import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createModerationRouter } from '../modules/moderation/routes';
import { moderationService } from '../modules/moderation/moderation.service';
import { moderationRepository } from '../modules/moderation/moderation.repository';
import { notificationsService } from '../modules/notifications/notifications.service';

const createApp = (role = 'MODERATOR', userId = 'moderator_1') => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { id: userId, email: `${userId}@example.com`, role, status: 'ACTIVE' }; next(); });
  app.use('/api/v1/moderation', createModerationRouter());
  return app;
};

const report = { id: 'report_1', reporterId: 'user_1', targetUserId: 'user_2', targetEntityType: 'USER', targetEntityId: 'user_2', reason: 'Harassment', status: 'PENDING', createdAt: new Date(), updatedAt: new Date(), resolvedAt: null, reporter: { id: 'user_1', name: 'Alice' }, targetUser: { id: 'user_2', name: 'Bob', status: 'ACTIVE' } };

describe('moderation module', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows users to submit valid reports and rejects invalid targets', async () => {
    vi.spyOn(moderationService, 'createReport').mockResolvedValue(report as never);
    const response = await request(createApp('USER', 'user_1')).post('/api/v1/moderation/reports').send({ targetUserId: 'user_2', reason: 'Harassment' });
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const invalid = await request(createApp('USER', 'user_1')).post('/api/v1/moderation/reports').send({ reason: 'Missing target' });
    expect(invalid.status).toBe(400);
  });

  it('restricts report review and actions to moderators/admins', async () => {
    const forbidden = await request(createApp('USER')).get('/api/v1/moderation/reports');
    expect(forbidden.status).toBe(403);

    vi.spyOn(moderationService, 'listOpenReports').mockResolvedValue([report] as never);
    const allowed = await request(createApp('MODERATOR')).get('/api/v1/moderation/reports');
    expect(allowed.status).toBe(200);

    vi.spyOn(moderationService, 'applyUserAction').mockResolvedValue({ id: 'user_2', name: 'Bob', status: 'SUSPENDED', warningCount: 0, isRestricted: false } as never);
    const suspend = await request(createApp('MODERATOR')).put('/api/v1/moderation/users/user_2/suspend').send({ reason: 'Repeated abuse' });
    expect(suspend.status).toBe(200);

    const moderatorBan = await request(createApp('MODERATOR')).put('/api/v1/moderation/users/user_2/ban').send({ reason: 'Severe abuse' });
    expect(moderatorBan.status).toBe(403);
  });

  it('allows moderators and admins to view audit logs but denies normal users', async () => {
    const normalUser = await request(createApp('USER')).get('/api/v1/moderation/audit-logs');
    expect(normalUser.status).toBe(403);

    vi.spyOn((await import('../infrastructure/audit/audit.service')).auditService, 'list').mockResolvedValue([] as never);
    expect((await request(createApp('MODERATOR')).get('/api/v1/moderation/audit-logs')).status).toBe(200);
    expect((await request(createApp('ADMIN')).get('/api/v1/moderation/audit-logs')).status).toBe(200);
  });

  it('applies actions with audit and affected-user notification', async () => {
    vi.spyOn(moderationRepository, 'applyUserAction').mockResolvedValue({ id: 'user_2', name: 'Bob', status: 'ACTIVE', warningCount: 1, isRestricted: true } as never);
    const notify = vi.spyOn(notificationsService, 'createSystemNotification').mockResolvedValue({ id: 'notification_1' } as never);
    const user = await moderationService.applyUserAction('user_2', 'moderator_1', 'WARN', 'Policy violation');
    expect(user.warningCount).toBe(1);
    expect(notify).toHaveBeenCalledWith('user_2', 'Moderation action', expect.stringContaining('warn'));
  });

  it('allows only admins to ban users', async () => {
    vi.spyOn(moderationService, 'applyUserAction').mockResolvedValue({ id: 'user_2', name: 'Bob', status: 'BANNED', warningCount: 0, isRestricted: false } as never);
    const response = await request(createApp('ADMIN')).put('/api/v1/moderation/users/user_2/ban').send({ reason: 'Severe abuse' });
    expect(response.status).toBe(200);
  });
});
