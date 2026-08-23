import prisma from '../../infrastructure/database/prisma';
import type { NotificationDraft } from './notification.templates';

export const notificationsRepository = {
  listByUser: async (userId: string, page: number, limit: number) => {
    const where = { recipientId: userId };
    const [total, notifications] = await prisma.$transaction([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { notifications, total };
  },

  unreadCount: (userId: string) => prisma.notification.count({ where: { recipientId: userId, isRead: false } }),

  markRead: async (userId: string, id: string) => {
    const result = await prisma.notification.updateMany({ where: { id, recipientId: userId, isRead: false }, data: { isRead: true } });
    if (result.count === 0) {
      const existing = await prisma.notification.findFirst({ where: { id, recipientId: userId }, select: { id: true } });
      if (!existing) throw new Error('NOTIFICATION_NOT_FOUND');
    }
  },

  markAllRead: (userId: string) => prisma.notification.updateMany({ where: { recipientId: userId, isRead: false }, data: { isRead: true } }),

  create: (draft: NotificationDraft) => prisma.notification.create({ data: draft }),
};
