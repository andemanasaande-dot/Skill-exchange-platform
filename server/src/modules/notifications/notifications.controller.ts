import { Request, Response } from 'express';
import { z } from 'zod';
import { notificationsService } from './notifications.service';
import { notificationQuerySchema } from './notifications.validation';

const userId = (req: Request, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return null;
  }
  return req.user.id;
};

const errorResponse = (res: Response, error: unknown) => {
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid notification request.', issues: error.issues } });
  if (error instanceof Error && error.message === 'NOTIFICATION_NOT_FOUND') return res.status(404).json({ success: false, error: { code: 'NOTIFICATION_NOT_FOUND', message: 'The notification could not be found.' } });
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to process notifications.' } });
};

export const notificationsController = {
  list: async (req: Request, res: Response) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      const query = notificationQuerySchema.parse(req.query);
      const result = await notificationsService.listNotifications(authenticatedUserId, query.page, query.limit);
      return res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },

  unreadCount: async (req: Request, res: Response) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      return res.status(200).json({ success: true, data: { count: await notificationsService.unreadCount(authenticatedUserId) } });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },

  markRead: async (req: Request, res: Response) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      await notificationsService.markRead(authenticatedUserId, Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      return res.status(200).json({ success: true, message: 'Notification marked as read.' });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },

  markAllRead: async (req: Request, res: Response) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      const result = await notificationsService.markAllRead(authenticatedUserId);
      return res.status(200).json({ success: true, data: { updated: result.count } });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },
};
