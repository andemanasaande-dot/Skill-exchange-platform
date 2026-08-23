import { z } from 'zod';

export const conversationIdSchema = z.object({
  id: z.string().trim().min(1),
});
