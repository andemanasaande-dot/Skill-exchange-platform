import prisma from '../../infrastructure/database/prisma';
import { auditService } from '../../infrastructure/audit/audit.service';

const reportSelect = {
  id: true, reporterId: true, targetUserId: true, targetEntityType: true, targetEntityId: true,
  reason: true, status: true, createdAt: true, updatedAt: true, resolvedAt: true,
  reporter: { select: { id: true, name: true } },
  targetUser: { select: { id: true, name: true, status: true } },
} as const;

export const moderationRepository = {
  listOpenReports: () => prisma.moderationReport.findMany({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: reportSelect }),
  getReport: (id: string) => prisma.moderationReport.findUnique({ where: { id }, select: reportSelect }),
  createReport: async (payload: { reporterId: string; targetUserId?: string; reason: string; entityType?: 'USER' | 'SKILL' | 'MESSAGE'; entityId?: string }) => prisma.$transaction(async (tx) => {
    const targetId = payload.entityId ?? payload.targetUserId;
    if (payload.entityType === 'USER' && !(await tx.user.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new Error('TARGET_NOT_FOUND');
    if (payload.entityType === 'SKILL' && !(await tx.skill.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new Error('TARGET_NOT_FOUND');
    if (payload.entityType === 'MESSAGE' && !(await tx.message.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new Error('TARGET_NOT_FOUND');
    if (!payload.entityType && payload.targetUserId && !(await tx.user.findUnique({ where: { id: payload.targetUserId }, select: { id: true } }))) throw new Error('TARGET_NOT_FOUND');
    const report = await tx.moderationReport.create({ data: { reporterId: payload.reporterId, targetUserId: payload.targetUserId ?? (payload.entityType === 'USER' ? payload.entityId : undefined), targetEntityType: payload.entityType, targetEntityId: payload.entityId, reason: payload.reason }, select: reportSelect });
    await auditService.recordWithClient(tx, { actorUserId: payload.reporterId, action: 'MODERATION_REPORT_CREATED', entityType: 'ModerationReport', entityId: report.id, payload: { targetEntityType: payload.entityType, targetEntityId: payload.entityId, targetUserId: payload.targetUserId } });
    return report;
  }),
  reviewReport: async (id: string, status: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED', actorUserId: string, actorRole: 'MODERATOR' | 'ADMIN', resolution?: string) => prisma.$transaction(async (tx) => {
    const existing = await tx.moderationReport.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new Error('REPORT_NOT_FOUND');
    if (actorRole !== 'ADMIN' && !['PENDING', 'UNDER_REVIEW'].includes(existing.status)) throw new Error('REPORT_ALREADY_CLOSED');
    const report = await tx.moderationReport.update({ where: { id }, data: { status, resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? new Date() : null }, select: reportSelect });
    await auditService.recordWithClient(tx, { actorUserId, action: `MODERATION_REPORT_${status}`, entityType: 'ModerationReport', entityId: id, payload: { resolution } });
    return report;
  }),
  applyUserAction: async (userId: string, action: 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN', actorUserId: string, reason?: string, durationHours?: number) => prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true, warningCount: true, isRestricted: true } });
    if (!existing) throw new Error('USER_NOT_FOUND');
    const data = action === 'WARN' ? { warningCount: { increment: 1 } } : action === 'RESTRICT' ? { isRestricted: true } : { status: action === 'SUSPEND' ? 'SUSPENDED' as const : 'BANNED' as const };
    const user = await tx.user.update({ where: { id: userId }, data, select: { id: true, name: true, status: true, warningCount: true, isRestricted: true } });
    await auditService.recordWithClient(tx, { actorUserId, action: `MODERATION_${action}`, entityType: 'User', entityId: userId, payload: { reason, durationHours, previousStatus: existing.status } });
    return user;
  }),
};
