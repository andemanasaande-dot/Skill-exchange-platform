import { z } from 'zod';

export const moderationReportSchema = z.object({
  targetUserId: z.string().min(1).optional(),
  reason: z.string().min(1).max(500),
  entityType: z.enum(['USER', 'SKILL', 'MESSAGE']).optional(),
  entityId: z.string().min(1).optional(),
}).strict().superRefine((data, context) => {
  if (!data.targetUserId && !(data.entityType && data.entityId)) {
    context.addIssue({ code: 'custom', path: ['target'], message: 'A user or entity target is required.' });
  }
  if (data.entityType === 'USER' && !data.entityId) {
    context.addIssue({ code: 'custom', path: ['entityId'], message: 'A user entity ID is required.' });
  }
});

export const reportIdSchema = z.object({ id: z.string().trim().min(1) });
export const reviewReportSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
  resolution: z.string().trim().max(500).optional(),
}).strict();
export const moderationActionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  durationHours: z.number().int().min(1).max(8760).optional(),
}).strict();
