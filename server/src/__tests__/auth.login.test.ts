import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';

import { authRepository } from '../modules/auth/auth.repository';
import { createAuthRouter } from '../modules/auth/routes';

describe('auth login', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in successfully and returns auth result', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const validPassword = 'StrongP@ssw0rd123';
    const passwordHash = await bcrypt.hash(validPassword, 10);

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'user_1',
      name: 'Alice Example',
      email: 'alice@example.com',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createRefreshToken').mockResolvedValue({
      id: 'refresh_1',
      userId: 'user_1',
      tokenHash: 'hashed_refresh',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_1',
      actorUserId: 'user_1',
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: 'user_1',
      payload: { email: 'alice@example.com' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'ALICE@example.com',
      password: validPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(response.body.data.user.email).toBe('alice@example.com');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain('skillswap.refresh=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1/auth');
  });

  it('rejects a wrong password', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const passwordHash = await bcrypt.hash('StrongP@ssw0rd123', 10);

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'user_2',
      name: 'Bob Example',
      email: 'bob@example.com',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_2',
      actorUserId: 'user_2',
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: 'user_2',
      payload: { reason: 'INVALID_CREDENTIALS' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'bob@example.com',
      password: 'WrongPassword!123',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects a nonexistent user', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue(null);
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_3',
      actorUserId: null,
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: 'missing@example.com',
      payload: { reason: 'INVALID_CREDENTIALS' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'missing@example.com',
      password: 'StrongP@ssw0rd123',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects suspended users', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const passwordHash = await bcrypt.hash('StrongP@ssw0rd123', 10);

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'user_3',
      name: 'Charlie Example',
      email: 'charlie@example.com',
      passwordHash,
      role: 'USER',
      status: 'SUSPENDED',
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_4',
      actorUserId: 'user_3',
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: 'user_3',
      payload: { reason: 'ACCOUNT_DISABLED', status: 'SUSPENDED' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'charlie@example.com',
      password: 'StrongP@ssw0rd123',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rejects banned users', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const passwordHash = await bcrypt.hash('StrongP@ssw0rd123', 10);

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'user_4',
      name: 'Dana Example',
      email: 'dana@example.com',
      passwordHash,
      role: 'USER',
      status: 'BANNED',
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_5',
      actorUserId: 'user_4',
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: 'user_4',
      payload: { reason: 'ACCOUNT_DISABLED', status: 'BANNED' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'dana@example.com',
      password: 'StrongP@ssw0rd123',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rejects deactivated users', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const passwordHash = await bcrypt.hash('StrongP@ssw0rd123', 10);

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'user_5',
      name: 'Eve Example',
      email: 'eve@example.com',
      passwordHash,
      role: 'USER',
      status: 'DEACTIVATED',
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_6',
      actorUserId: 'user_5',
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: 'user_5',
      payload: { reason: 'ACCOUNT_DISABLED', status: 'DEACTIVATED' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'eve@example.com',
      password: 'StrongP@ssw0rd123',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});
