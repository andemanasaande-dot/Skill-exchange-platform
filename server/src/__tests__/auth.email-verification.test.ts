import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authRepository } from '../modules/auth/auth.repository';
import { createAuthRouter } from '../modules/auth/routes';
import { defaultEmailService } from '../infrastructure/email/email.service';
import { generateEmailVerificationToken } from '../modules/auth/auth.service';

describe('auth email verification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies a valid email token and updates the user', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const token = generateEmailVerificationToken();
    const verificationRecord = {
      id: 'token_1',
      userId: 'user_1',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user_1',
        name: 'Alice Example',
        email: 'alice@example.com',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: false,
      },
    };

    vi.spyOn(authRepository, 'findVerificationTokenByHash').mockResolvedValue(verificationRecord as never);
    vi.spyOn(authRepository, 'updateEmailVerificationStatus').mockResolvedValue({
      id: 'user_1',
      name: 'Alice Example',
      email: 'alice@example.com',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'markVerificationTokenUsed').mockResolvedValue({
      id: 'token_1',
      userId: 'user_1',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_1',
      actorUserId: 'user_1',
      action: 'EMAIL_VERIFIED',
      entityType: 'EMAIL_VERIFICATION',
      entityId: 'user_1',
      payload: { email: 'alice@example.com' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/verify-email').send({ token });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.verified).toBe(true);
    expect(response.body.data.email).toBe('alice@example.com');
    expect(response.body.message).toBe('Email verified successfully.');
  });

  it('rejects an invalid verification token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findVerificationTokenByHash').mockResolvedValue(null);

    const response = await request(app).post('/api/v1/auth/verify-email').send({ token: 'bad-token' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');
  });

  it('rejects an expired verification token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const token = generateEmailVerificationToken();
    vi.spyOn(authRepository, 'findVerificationTokenByHash').mockResolvedValue({
      id: 'token_2',
      userId: 'user_2',
      tokenHash: 'expired-token',
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user_2',
        name: 'Bob Example',
        email: 'bob@example.com',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: false,
      },
    } as never);

    const response = await request(app).post('/api/v1/auth/verify-email').send({ token });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('VERIFICATION_TOKEN_EXPIRED');
  });

  it('rejects an already verified email', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const token = generateEmailVerificationToken();
    vi.spyOn(authRepository, 'findVerificationTokenByHash').mockResolvedValue({
      id: 'token_3',
      userId: 'user_3',
      tokenHash: 'already-verified-token',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user_3',
        name: 'Charlie Example',
        email: 'charlie@example.com',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
      },
    } as never);

    const response = await request(app).post('/api/v1/auth/verify-email').send({ token });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_VERIFIED');
  });

  it('sends a verification email and does not expose the token in the response', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    const emailServiceSpy = vi.spyOn(defaultEmailService, 'sendVerificationEmail').mockResolvedValue();
    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'user_4',
      name: 'Dana Example',
      email: 'dana@example.com',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: false,
      avatarUrl: null,
      bio: null,
      passwordHash: 'hashed-password',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'findLatestVerificationTokenByUserId').mockResolvedValue(null);
    vi.spyOn(authRepository, 'createVerificationToken').mockResolvedValue({
      id: 'token_4',
      userId: 'user_4',
      tokenHash: 'new-token-hash',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue({
      id: 'audit_2',
      actorUserId: 'user_4',
      action: 'EMAIL_VERIFICATION_SENT',
      entityType: 'EMAIL_VERIFICATION',
      entityId: 'user_4',
      payload: { email: 'dana@example.com' },
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/resend-verification').send({ email: 'dana@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('dana@example.com');
    expect(response.body.data.token).toBeUndefined();
    expect(emailServiceSpy).toHaveBeenCalled();
  });

  it('rate limits verification email resends', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRouter());

    vi.spyOn(authRepository, 'findByEmail').mockResolvedValue({
      id: 'user_5',
      name: 'Eve Example',
      email: 'eve@example.com',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: false,
      avatarUrl: null,
      bio: null,
      passwordHash: 'hashed-password',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(authRepository, 'findLatestVerificationTokenByUserId').mockResolvedValue({
      id: 'token_5',
      userId: 'user_5',
      tokenHash: 'recent-hash',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(Date.now() - 30_000),
      updatedAt: new Date(),
    });

    const response = await request(app).post('/api/v1/auth/resend-verification').send({ email: 'eve@example.com' });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('VERIFICATION_RESEND_RATE_LIMITED');
  });
});
