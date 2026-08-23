import { z } from 'zod';

export const createSkillSchema = z.object({
  title: z.string().min(2).max(100),
  categoryId: z.string().min(1),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateSkillSchema = createSkillSchema.partial();
export const skillIdSchema = z.object({ id: z.string().trim().min(1) });
