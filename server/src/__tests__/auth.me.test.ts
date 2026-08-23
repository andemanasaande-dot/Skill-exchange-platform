import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authRepository } from '../modules/auth/auth.repository';
import { createAuthRouter } from '../modules/auth/routes';
import { generateAccessToken } from '../modules/auth/auth.service';

describe('auth me', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the current user without exposing private auth fields', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const user = {
      id: 'user_123',
      name: 'Alice Example',
      email: 'alice@example.com',
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      emailVerified: true,
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'Frontend developer',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(authRepository, 'findById').mockResolvedValue(user as never);

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    });
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.refreshTokens).toBeUndefined();
    expect(response.body.data.user.tokenHash).toBeUndefined();
  });

  it('returns 401 when no valid access token is provided', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
