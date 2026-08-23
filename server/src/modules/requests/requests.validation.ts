import { z } from 'zod';

export const createRequestSchema = z.object({
  receiverId: z.string().trim().min(1),
  skillId: z.string().trim().min(1),
  message: z.string().trim().max(500).optional(),
}).strict();

export const requestIdSchema = z.object({ id: z.string().trim().min(1) });
export const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }).strict();
