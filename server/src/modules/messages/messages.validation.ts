import { z } from 'zod';

export const createMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required.').max(2000, 'Message content cannot exceed 2000 characters.'),
  conversationId: z.string().min(1),
});

export const messageConversationIdSchema = z.object({ id: z.string().trim().min(1) });
export const messageIdSchema = z.object({ id: z.string().trim().min(1) });
export const messageQuerySchema = z.object({
  page: z.preprocess((value) => value === undefined ? 1 : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(1)),
  limit: z.preprocess((value) => value === undefined ? 50 : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(1).max(100)),
  cursor: z.string().trim().min(1).optional(),
}).strict();
