import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { validateParams, validateQuery } from '../../middleware/validation.middleware';
import { notificationIdSchema, notificationQuerySchema } from './notifications.validation';

export const createNotificationsRouter = () => {
  const router = Router();

  router.get('/', validateQuery(notificationQuerySchema), notificationsController.list);
  router.get('/unread-count', notificationsController.unreadCount);
  router.put('/read-all', notificationsController.markAllRead);
  router.put('/:id/read', validateParams(notificationIdSchema), notificationsController.markRead);

  return router;
};
