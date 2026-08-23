import { Request, Response } from 'express';
import { z } from 'zod';
import { moderationService } from './moderation.service';
import { moderationReportSchema, moderationActionSchema, reviewReportSchema } from './moderation.validation';
import { auditService } from '../../infrastructure/audit/audit.service';

const errorResponse = (res: Response, error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  const statuses: Record<string, [number, string]> = { TARGET_NOT_FOUND: [404, 'The moderation target could not be found.'], USER_NOT_FOUND: [404, 'The user could not be found.'], REPORT_NOT_FOUND: [404, 'The moderation report could not be found.'], REPORT_ALREADY_CLOSED: [409, 'Only admins can override a closed moderation report.'] };
  const [status, message] = statuses[code] ?? [500, 'Unable to process the moderation action.'];
  return res.status(status).json({ success: false, error: { code: statuses[code] ? code : 'INTERNAL_SERVER_ERROR', message } });
};

const actorId = (req: Request, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return null;
  }
  return req.user.id;
};

export const moderationController = {
  listOpenReports: async (_req: Request, res: Response) => {
    try { return res.status(200).json({ success: true, data: await moderationService.listOpenReports() }); } catch (error: unknown) { return errorResponse(res, error); }
  },

  createReport: async (req: Request, res: Response) => {
    const reporterId = actorId(req, res);
    if (!reporterId) return;
    try {
      const payload = moderationReportSchema.parse(req.body);
      const report = await moderationService.createReport({ ...payload, reporterId });
      return res.status(201).json({ success: true, data: report });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Moderation report validation failed.', issues: error.issues } });
      }
      return errorResponse(res, error);
    }
  },

  getReport: async (req: Request, res: Response) => {
    try { const report = await moderationService.getReport(req.params.id as string); if (!report) return errorResponse(res, new Error('REPORT_NOT_FOUND')); return res.status(200).json({ success: true, data: report }); } catch (error: unknown) { return errorResponse(res, error); }
  },

  listAuditLogs: async (req: Request, res: Response) => {
    try {
      const logs = await auditService.list({ entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined, entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined });
      return res.status(200).json({ success: true, data: logs });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },

  reviewReport: async (req: Request, res: Response) => {
    const id = actorId(req, res); if (!id) return;
    try { const payload = reviewReportSchema.parse(req.body); const role = req.user?.role === 'ADMIN' ? 'ADMIN' : 'MODERATOR'; return res.status(200).json({ success: true, data: await moderationService.reviewReport(req.params.id as string, id, role, payload.status, payload.resolution) }); } catch (error: unknown) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Review validation failed.', issues: error.issues } }); return errorResponse(res, error); }
  },

  userAction: async (req: Request, res: Response, action: 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN') => {
    const actor = actorId(req, res); if (!actor) return;
    try { const payload = moderationActionSchema.parse(req.body); const user = await moderationService.applyUserAction(req.params.id as string, actor, action, payload.reason, payload.durationHours); return res.status(200).json({ success: true, data: user }); } catch (error: unknown) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Moderation action validation failed.', issues: error.issues } }); return errorResponse(res, error); }
  },
};
