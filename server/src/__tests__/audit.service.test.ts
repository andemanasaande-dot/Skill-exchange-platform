import { afterEach, describe, expect, it, vi } from 'vitest';
import { auditService, sanitizeAuditPayload } from '../infrastructure/audit/audit.service';
import prisma from '../infrastructure/database/prisma';

describe('centralized audit service', () => {
  afterEach(() => vi.restoreAllMocks());

  it('recursively redacts secrets, passwords, tokens, and hashes', () => {
    expect(sanitizeAuditPayload({ password: 'secret', nested: { accessToken: 'token', value: 'safe' }, items: [{ refreshToken: 'token' }] })).toEqual({
      password: '[REDACTED]', nested: { accessToken: '[REDACTED]', value: 'safe' }, items: [{ refreshToken: '[REDACTED]' }],
    });
  });

  it('records reusable audit fields through Prisma without exposing raw payload secrets', async () => {
    const create = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'audit_1' } as never);
    await auditService.record({ actorUserId: 'user_1', action: 'LOGIN_SUCCESS', entityType: 'User', entityId: 'user_1', payload: { token: 'secret', method: 'password' } });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: 'user_1', action: 'LOGIN_SUCCESS', entityType: 'User', entityId: 'user_1', payload: { token: '[REDACTED]', method: 'password' } }) });
  });

  it('reads newest-first audit records with a bounded limit', async () => {
    const findMany = vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([] as never);
    await auditService.list({ entityType: 'User', limit: 1000 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
  });
});
