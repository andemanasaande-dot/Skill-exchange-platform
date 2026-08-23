import type { DomainEvent } from '../../infrastructure/events/event-definitions';
import { eventBus } from '../../infrastructure/events/event-bus';
import { notificationTemplates, type NotificationEvent } from './notification.templates';
import { notificationsRepository } from './notifications.repository';

export const notificationsService = {
  listNotifications: async (userId: string, page: number, limit: number) => {
    const result = await notificationsRepository.listByUser(userId, page, limit);
    return { data: result.notifications, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
  },

  unreadCount: (userId: string) => notificationsRepository.unreadCount(userId),
  markRead: (userId: string, notificationId: string) => notificationsRepository.markRead(userId, notificationId),
  markAllRead: (userId: string) => notificationsRepository.markAllRead(userId),

  handleEvent: async (event: NotificationEvent) => {
    const draft = notificationTemplates.fromEvent(event);
    if (!draft) return;
    if (event.type === 'message.sent' && event.payload.recipientIds) {
      const recipientIds = (event as DomainEvent<'message.sent'>).payload.recipientIds ?? [];
      await Promise.all(recipientIds.map((recipientId) => notificationsRepository.create({ ...draft, recipientId })));
      return;
    }
    await notificationsRepository.create(draft);
  },

  createSystemNotification: (recipientId: string, title: string, body: string) =>
    notificationsRepository.create(notificationTemplates.system(recipientId, title, body)),
};

let subscribersRegistered = false;

export const registerNotificationSubscribers = () => {
  if (subscribersRegistered) return;
  subscribersRegistered = true;
  const eventTypes = ['request.created', 'request.accepted', 'request.rejected', 'message.sent', 'moderation.flagged'] as const;
  eventTypes.forEach((eventType) => eventBus.subscribe(eventType, (event) => notificationsService.handleEvent(event as NotificationEvent)));
};
