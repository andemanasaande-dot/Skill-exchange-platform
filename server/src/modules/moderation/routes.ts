import { Router } from 'express';
import { moderationController } from './moderation.controller';
import { requireRole } from '../../middleware/auth.middleware';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import { moderationReportSchema, reportIdSchema, reviewReportSchema, moderationActionSchema } from './moderation.validation';

export const createModerationRouter = () => {
  const router = Router();

  router.post('/reports', validateBody(moderationReportSchema), moderationController.createReport);
  router.get('/reports', requireRole(['MODERATOR', 'ADMIN']), moderationController.listOpenReports);
  router.get('/audit-logs', requireRole(['MODERATOR', 'ADMIN']), moderationController.listAuditLogs);
  router.get('/reports/:id', requireRole(['MODERATOR', 'ADMIN']), validateParams(reportIdSchema), moderationController.getReport);
  router.put('/reports/:id/review', requireRole(['MODERATOR', 'ADMIN']), validateParams(reportIdSchema), validateBody(reviewReportSchema), moderationController.reviewReport);
  router.put('/users/:id/warn', requireRole(['MODERATOR', 'ADMIN']), validateParams(reportIdSchema), validateBody(moderationActionSchema), (req, res) => moderationController.userAction(req, res, 'WARN'));
  router.put('/users/:id/restrict', requireRole(['MODERATOR', 'ADMIN']), validateParams(reportIdSchema), validateBody(moderationActionSchema), (req, res) => moderationController.userAction(req, res, 'RESTRICT'));
  router.put('/users/:id/suspend', requireRole(['MODERATOR', 'ADMIN']), validateParams(reportIdSchema), validateBody(moderationActionSchema), (req, res) => moderationController.userAction(req, res, 'SUSPEND'));
  router.put('/users/:id/ban', requireRole(['ADMIN']), validateParams(reportIdSchema), validateBody(moderationActionSchema), (req, res) => moderationController.userAction(req, res, 'BAN'));

  return router;
};
