import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';

import { env } from '../config/env';
import { authRepository } from '../modules/auth/auth.repository';
import { createAuthRouter } from '../modules/auth/routes';
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from '../modules/auth/auth.service';

describe('auth refresh lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('issues a new access token and rotates the refresh token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const user = { id: 'user_1', email: 'alice@example.com', role: 'USER' as const, status: 'ACTIVE' as const };
    const oldRefreshToken = generateRefreshToken(user);
    const oldTokenHash = await hashRefreshToken(oldRefreshToken);

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: user.id,
      name: 'Alice Example',
      email: user.email,
      passwordHash: await bcrypt.hash('StrongP@ssw0rd123', 10),
      role: user.role,
      status: user.status,
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'findRefreshTokenByHash').mockResolvedValue({
      id: 'token_1',
      userId: user.id,
      tokenHash: oldTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
    vi.spyOn(authRepository, 'revokeRefreshToken').mockResolvedValue({
      id: 'token_1',
      userId: user.id,
      tokenHash: oldTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createRefreshToken').mockResolvedValue({
      id: 'token_2',
      userId: user.id,
      tokenHash: 'new_hash',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_1',
      actorUserId: user.id,
      action: 'REFRESH_SUCCESS',
      entityType: 'AUTH',
      entityId: user.id,
      payload: null,
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefreshToken });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain('skillswap.refresh=');
    expect(response.headers['set-cookie'][0]).not.toContain(encodeURIComponent(oldRefreshToken));
  });

  it('rejects an expired refresh token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const user = { id: 'user_2', email: 'bob@example.com', role: 'USER' as const, status: 'ACTIVE' as const };
    const { default: jwt } = await import('jsonwebtoken');
    const expiredToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, status: user.status, type: 'refresh' },
      env.jwtRefreshSecret,
      { expiresIn: '-1h' },
    );
    const expiredHash = await hashRefreshToken(expiredToken);

    vi.spyOn(authRepository, 'findRefreshTokenByHash').mockResolvedValue({
      id: 'token_expired',
      userId: user.id,
      tokenHash: expiredHash,
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    });

    const response = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: expiredToken });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  it('rejects a revoked refresh token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const user = { id: 'user_3', email: 'carol@example.com', role: 'USER' as const, status: 'ACTIVE' as const };
    const revokedToken = generateRefreshToken(user);
    const revokedHash = await hashRefreshToken(revokedToken);

    vi.spyOn(authRepository, 'findRefreshTokenByHash').mockResolvedValue({
      id: 'token_revoked',
      userId: user.id,
      tokenHash: revokedHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    });

    const response = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: revokedToken });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('rejects refresh token reuse after revocation', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const user = { id: 'user_4', email: 'dave@example.com', role: 'USER' as const, status: 'ACTIVE' as const };
    const reusedToken = generateRefreshToken(user);
    const reusedHash = await hashRefreshToken(reusedToken);

    vi.spyOn(authRepository, 'findRefreshTokenByHash').mockResolvedValue({
      id: 'token_reused',
      userId: user.id,
      tokenHash: reusedHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    });

    const response = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reusedToken });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('revokes the current refresh token on logout', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const user = { id: 'user_5', email: 'erin@example.com', role: 'USER' as const, status: 'ACTIVE' as const };
    const refreshToken = generateRefreshToken(user);
    const refreshHash = await hashRefreshToken(refreshToken);

    vi.spyOn(authRepository, 'findRefreshTokenByHash').mockResolvedValue({
      id: 'token_logout',
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    });
    vi.spyOn(authRepository, 'revokeRefreshToken').mockResolvedValue({
      id: 'token_logout',
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_logout',
      actorUserId: user.id,
      action: 'LOGOUT_SUCCESS',
      entityType: 'AUTH',
      entityId: user.id,
      payload: null,
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/logout').send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Logout successful.');
  });

  it('revokes all active refresh tokens for the authenticated user', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const user = { id: 'user_6', email: 'frank@example.com', role: 'USER' as const, status: 'ACTIVE' as const };
    const accessToken = generateAccessToken(user);

    vi.spyOn(authRepository, 'revokeAllActiveRefreshTokensForUser').mockResolvedValue(3);
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_logout_all',
      actorUserId: user.id,
      action: 'LOGOUT_ALL_SUCCESS',
      entityType: 'AUTH',
      entityId: user.id,
      payload: { count: 3 },
      createdAt: new Date(),
    });

    const response = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.revokedCount).toBe(3);
  });
});
