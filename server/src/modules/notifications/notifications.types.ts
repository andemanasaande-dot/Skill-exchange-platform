export type NotificationType = 'request' | 'message' | 'system';

export type NotificationRecord = {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
};
