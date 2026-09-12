import { z } from 'zod';

export const adminEntityIdSchema = z.object({ id: z.string().trim().min(1) });
export const skillStatusSchema = z.object({ isActive: z.boolean() });
export const categoryCreateSchema = z.object({ name: z.string().trim().min(2).max(100), slug: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional() });
export const categoryUpdateSchema = categoryCreateSchema.partial();