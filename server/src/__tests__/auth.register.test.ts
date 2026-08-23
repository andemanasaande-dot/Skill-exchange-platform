import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authRepository } from '../modules/auth/auth.repository';
import { createAuthRouter } from '../modules/auth/routes';

describe('auth registration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a user successfully', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue(null);
    vi.spyOn(authRepository, 'createUser').mockResolvedValue({
      id: 'user_123',
      name: 'Alice Example',
      email: 'alice@example.com',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: false,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Alice Example',
        email: 'ALICE@example.com',
        password: 'StrongP@ssw0rd123',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('alice@example.com');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.emailVerified).toBe(false);
    expect(response.body.data.user.status).toBe('ACTIVE');
  });

  it('rejects duplicate email addresses', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'existing_user',
      name: 'Existing User',
      email: 'alice@example.com',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: false,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Again',
      email: 'alice@example.com',
      password: 'AnotherStrongP@ssw0rd123',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects invalid email', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Example',
      email: 'not-an-email',
      password: 'StrongP@ssw0rd123',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects weak password', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Example',
      email: 'alice@example.com',
      password: 'weak',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing fields', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'alice@example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
