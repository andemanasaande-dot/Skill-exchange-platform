import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUsersRouter } from '../modules/users/routes';
import { usersRepository } from '../modules/users/users.repository';

describe('user blocking', () => {
  afterEach(() => vi.restoreAllMocks());

  const createApp = (userId = 'user_1') => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: userId, email: `${userId}@example.com`, role: 'USER', status: 'ACTIVE' };
      next();
    });
    app.use('/api/v1', createUsersRouter());
    return app;
  };

  it('blocks, reports status, and unblocks a user for the authenticated owner', async () => {
    vi.spyOn(usersRepository, 'findExists').mockResolvedValue({ id: 'user_2' } as never);
    vi.spyOn(usersRepository, 'block').mockResolvedValue({ id: 'block_1', blockerId: 'user_1', blockedId: 'user_2', createdAt: new Date() } as never);
    const status = vi.spyOn(usersRepository, 'isBlocked').mockResolvedValue({ id: 'block_1' } as never);
    const unblock = vi.spyOn(usersRepository, 'unblock').mockResolvedValue({ count: 1 });

    expect((await request(createApp()).post('/api/v1/users/user_2/block')).status).toBe(201);
    expect((await request(createApp()).get('/api/v1/users/user_2/block-status')).body.data.blocked).toBe(true);
    status.mockResolvedValue(null);
    expect((await request(createApp()).get('/api/v1/users/user_2/block-status')).body.data.blocked).toBe(false);
    expect((await request(createApp()).delete('/api/v1/users/user_2/block')).status).toBe(204);
    expect(unblock).toHaveBeenCalledWith('user_1', 'user_2');
  });

  it('rejects self-blocking and missing targets', async () => {
    expect((await request(createApp()).post('/api/v1/users/user_1/block')).status).toBe(400);
    vi.spyOn(usersRepository, 'findExists').mockResolvedValue(null);
    expect((await request(createApp()).post('/api/v1/users/missing/block')).status).toBe(404);
  });
});
