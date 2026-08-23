import { eventBus } from '../../infrastructure/events/event-bus';
import { moderationRepository } from './moderation.repository';
import { notificationsService } from '../notifications/notifications.service';

export const moderationService = {
  listOpenReports: () => moderationRepository.listOpenReports(),
  getReport: (id: string) => moderationRepository.getReport(id),
  createReport: async (payload: { reporterId: string; targetUserId?: string; reason: string; entityType?: 'USER' | 'SKILL' | 'MESSAGE'; entityId?: string }) => {
    const report = await moderationRepository.createReport(payload);
    await eventBus.publish('moderation.flagged', {
      reportId: report.id,
      reporterId: report.reporterId,
      targetUserId: report.targetUserId ?? undefined,
      reason: report.reason,
    });
    return report;
  },
  reviewReport: (id: string, actorUserId: string, actorRole: 'MODERATOR' | 'ADMIN', status: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED', resolution?: string) => moderationRepository.reviewReport(id, status, actorUserId, actorRole, resolution),
  applyUserAction: async (userId: string, actorUserId: string, action: 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN', reason?: string, durationHours?: number) => {
    const user = await moderationRepository.applyUserAction(userId, action, actorUserId, reason, durationHours);
    await notificationsService.createSystemNotification(user.id, 'Moderation action', `A moderation action was applied to your account: ${action.toLowerCase()}.`);
    return user;
  },
};
