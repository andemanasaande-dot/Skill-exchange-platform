import { describe, expect, it, vi } from 'vitest';
import prisma from '../infrastructure/database/prisma';
import { requireActiveUser, requireRole } from '../middleware/auth.middleware';

const response = () => {
  const result = { statusCode: 0, body: undefined as unknown };
  return {
    result,
    status(code: number) { result.statusCode = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  };
};

describe('authorization boundaries', () => {
  it('denies requests without an authenticated principal', () => {
    const res = response();
    requireRole('ADMIN')({ user: undefined } as never, res as never, vi.fn());
    expect(res.result.statusCode).toBe(401);
    expect((res.result.body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  });

  it('denies roles outside the allowed RBAC set', () => {
    const res = response();
    requireRole(['ADMIN', 'MODERATOR'])({ user: { id: 'user_1', email: 'user@example.com', role: 'USER' } } as never, res as never, vi.fn());
    expect(res.result.statusCode).toBe(403);
    expect((res.result.body as { error: { code: string } }).error.code).toBe('FORBIDDEN');
  });

  it('passes only allowed roles to the protected handler', () => {
    const next = vi.fn();
    const res = response();
    requireRole('ADMIN')({ user: { id: 'admin_1', email: 'admin@example.com', role: 'ADMIN' } } as never, res as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.result.statusCode).toBe(0);
  });

  it('refreshes the role from the database before privileged authorization', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ status: 'ACTIVE', isRestricted: false, role: 'USER' } as never);
    const req = { user: { id: 'admin_1', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE' } } as never;
    const res = response();
    const next = vi.fn();

    await requireActiveUser(req, res as never, next);
    requireRole('ADMIN')(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.result.statusCode).toBe(403);
  });

  it('blocks a suspended account even when its access token says active', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ status: 'SUSPENDED', isRestricted: false, role: 'ADMIN' } as never);
    const res = response();
    const next = vi.fn();

    await requireActiveUser({ user: { id: 'admin_1', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE' } } as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.result.statusCode).toBe(403);
  });
});
