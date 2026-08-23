import { Prisma } from '@prisma/client';
import prisma from '../database/prisma';

const sensitiveKey = /(password|token|secret|authorization|cookie|credential|hash)/i;

export const sanitizeAuditPayload = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditPayload(item) ?? null);
  if (typeof value === 'object') {
    const result: Record<string, Prisma.InputJsonValue> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      result[key] = sensitiveKey.test(key) ? '[REDACTED]' : sanitizeAuditPayload(item) ?? '[REDACTED]';
    });
    return result;
  }
  return String(value);
};

export type AuditRecord = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
};

const auditData = (record: AuditRecord) => ({
  actorUserId: record.actorUserId ?? null,
  action: record.action,
  entityType: record.entityType,
  entityId: record.entityId,
  payload: sanitizeAuditPayload(record.payload),
});

export const auditService = {
  record: (record: AuditRecord) => prisma.auditLog.create({ data: auditData(record) }),

  recordWithClient: (client: Prisma.TransactionClient, record: AuditRecord) => client.auditLog.create({ data: auditData(record) }),

  list: async (options?: { entityType?: string; entityId?: string; limit?: number }) => prisma.auditLog.findMany({
    where: { entityType: options?.entityType, entityId: options?.entityId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(options?.limit ?? 100, 100),
    select: { id: true, actorUserId: true, action: true, entityType: true, entityId: true, payload: true, createdAt: true },
  }),
};
