import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authRepository } from '../modules/auth/auth.repository';
import { createAuthRouter } from '../modules/auth/routes';

describe('auth password recovery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid reset token and changes the password', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const token = 'reset-token-1';
    vi.spyOn(authRepository, 'findPasswordResetTokenByHash').mockResolvedValue({
      id: 'reset_1',
      userId: 'user_1',
      tokenHash: 'hashed-reset-token-1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user_1',
        email: 'alice@example.com',
        name: 'Alice Example',
        role: 'USER',
        status: 'ACTIVE',
      },
    } as never);
    vi.spyOn(authRepository, 'updatePasswordHash').mockResolvedValue({
      id: 'user_1',
      email: 'alice@example.com',
      name: 'Alice Example',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'revokeAllActiveRefreshTokensForUser').mockResolvedValue(2);
    vi.spyOn(authRepository, 'markPasswordResetTokenUsed').mockResolvedValue({
      id: 'reset_1',
      userId: 'user_1',
      tokenHash: 'hashed-reset-token-1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_1',
      actorUserId: 'user_1',
      action: 'PASSWORD_RESET_SUCCESS',
      entityType: 'AUTH',
      entityId: 'user_1',
      payload: { email: 'alice@example.com' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token,
      password: 'NewStrongP@ssw0rd1',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.reset).toBe(true);
  });

  it('rejects an invalid reset token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findPasswordResetTokenByHash').mockResolvedValue(null);

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: 'bad-token',
      password: 'NewStrongP@ssw0rd1',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects an expired reset token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findPasswordResetTokenByHash').mockResolvedValue({
      id: 'reset_2',
      userId: 'user_2',
      tokenHash: 'hash-2',
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user_2',
        email: 'bob@example.com',
        name: 'Bob Example',
        role: 'USER',
        status: 'ACTIVE',
      },
    } as never);

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: 'expired-token',
      password: 'NewStrongP@ssw0rd1',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('RESET_TOKEN_EXPIRED');
  });

  it('rejects a reused reset token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findPasswordResetTokenByHash').mockResolvedValue({
      id: 'reset_3',
      userId: 'user_3',
      tokenHash: 'hash-3',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user_3',
        email: 'charlie@example.com',
        name: 'Charlie Example',
        role: 'USER',
        status: 'ACTIVE',
      },
    } as never);

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: 'reused-token',
      password: 'NewStrongP@ssw0rd1',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('RESET_TOKEN_USED');
  });

  it('rejects a weak password during reset', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: 'good-token',
      password: 'weakpass',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responds without revealing whether an email exists when a reset is requested', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue(null);

    const response = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'missing@example.com',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('If an account exists');
  });

  it('sends a reset email for an existing account', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'user_4',
      name: 'Dana Example',
      email: 'dana@example.com',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      passwordHash: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'findLatestPasswordResetTokenByUserId').mockResolvedValue(null);
    vi.spyOn(authRepository, 'createPasswordResetToken').mockResolvedValue({
      id: 'reset_4',
      userId: 'user_4',
      tokenHash: 'hashed-reset-4',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_4',
      actorUserId: 'user_4',
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'AUTH',
      entityId: 'user_4',
      payload: { email: 'dana@example.com' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'dana@example.com',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('dana@example.com');
  });
});
