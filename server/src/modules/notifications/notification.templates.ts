import type { DomainEvent } from '../../infrastructure/events/event-definitions';

export type NotificationDraft = {
  recipientId: string;
  type: 'REQUEST_CREATED' | 'REQUEST_ACCEPTED' | 'REQUEST_REJECTED' | 'REQUEST_COMPLETED' | 'NEW_MESSAGE' | 'REVIEW_RECEIVED' | 'MODERATION' | 'SYSTEM';
  title: string;
  body: string;
};

export type NotificationEvent =
  | DomainEvent<'request.created'>
  | DomainEvent<'request.accepted'>
  | DomainEvent<'request.rejected'>
  | DomainEvent<'request.completed'>
  | DomainEvent<'message.sent'>
  | DomainEvent<'review.created'>
  | DomainEvent<'moderation.flagged'>;

export const notificationTemplates = {
  fromEvent: (event: NotificationEvent): NotificationDraft | null => {
    if (event.type === 'request.created') {
      return { recipientId: event.payload.receiverId, type: 'REQUEST_CREATED', title: 'New skill exchange request', body: 'You received a new skill exchange request.' };
    }
    if (event.type === 'request.accepted') {
      return { recipientId: event.payload.senderId, type: 'REQUEST_ACCEPTED', title: 'Request accepted', body: 'Your skill exchange request was accepted.' };
    }
    if (event.type === 'request.rejected') {
      return { recipientId: event.payload.senderId, type: 'REQUEST_REJECTED', title: 'Request rejected', body: 'Your skill exchange request was rejected.' };
    }
    if (event.type === 'request.completed') {
      const recipientId = event.payload.actorUserId === event.payload.senderId ? event.payload.receiverId : event.payload.senderId;
      return { recipientId, type: 'REQUEST_COMPLETED', title: 'Exchange completed', body: 'Your skill exchange was marked as completed.' };
    }
    if (event.type === 'message.sent') {
      const recipientId = event.payload.recipientIds?.[0];
      if (!recipientId) return null;
      return { recipientId, type: 'NEW_MESSAGE', title: 'New message', body: 'You have a new message.' };
    }
    if (event.type === 'review.created') {
      return { recipientId: event.payload.recipientId, type: 'REVIEW_RECEIVED', title: 'You received a review', body: `A participant rated your exchange ${event.payload.rating}/5.` };
    }
    return { recipientId: event.payload.reporterId, type: 'MODERATION', title: 'Moderation report received', body: 'Your moderation report was received.' };
  },

  system: (recipientId: string, title: string, body: string): NotificationDraft => ({
    recipientId,
    type: 'SYSTEM',
    title,
    body,
  }),
};
