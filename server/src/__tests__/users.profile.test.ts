import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUsersRouter } from '../modules/users/routes';
import { usersRepository } from '../modules/users/users.repository';
import { auditService } from '../infrastructure/audit/audit.service';

describe('user profile module', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(auditService, 'record').mockResolvedValue({ id: 'audit_1' } as never);
  });

  it('updates the authenticated user profile', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'user_1', email: 'alice@example.com', role: 'USER', status: 'ACTIVE' };
      next();
    });
    app.use('/api/v1', createUsersRouter());

    vi.spyOn(usersRepository, 'findById').mockResolvedValue({
      id: 'user_1',
      name: 'Alice Example',
      email: 'alice@example.com',
      bio: 'Old bio',
      location: 'Seattle',
      avatarUrl: 'https://example.com/old.png',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.spyOn(usersRepository, 'updateProfile').mockResolvedValue({
      id: 'user_1',
      name: 'Alice Updated',
      email: 'alice@example.com',
      bio: 'New bio',
      location: 'London',
      avatarUrl: 'https://example.com/new.png',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const response = await request(app).put('/api/v1/profile').send({
      name: 'Alice Updated',
      bio: 'New bio',
      location: 'London',
      avatarUrl: 'https://example.com/new.png',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.name).toBe('Alice Updated');
    expect(response.body.data.user.location).toBe('London');
  });

  it('rejects updates for another user', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'user_1', email: 'alice@example.com', role: 'USER', status: 'ACTIVE' };
      next();
    });
    app.use('/api/v1', createUsersRouter());

    const response = await request(app).put('/api/v1/users/user_2').send({
      name: 'Mallory',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns a public profile without private fields', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'user_1', email: 'alice@example.com', role: 'USER', status: 'ACTIVE' };
      next();
    });
    app.use('/api/v1', createUsersRouter());

    vi.spyOn(usersRepository, 'findPublicProfileById').mockResolvedValue({
      id: 'user_2',
      name: 'Bob Example',
      bio: 'Developer',
      location: 'Paris',
      avatarUrl: 'https://example.com/bob.png',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const response = await request(app).get('/api/v1/users/user_2');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBeUndefined();
    expect(response.body.data.user.role).toBeUndefined();
    expect(response.body.data.user.name).toBe('Bob Example');
  });

  it('rejects invalid profile payloads', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'user_1', email: 'alice@example.com', role: 'USER', status: 'ACTIVE' };
      next();
    });
    app.use('/api/v1', createUsersRouter());

    const response = await request(app).put('/api/v1/profile').send({
      id: 'user_9',
      email: 'hacker@example.com',
      role: 'ADMIN',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
