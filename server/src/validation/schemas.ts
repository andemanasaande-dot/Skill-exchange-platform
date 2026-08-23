import { z } from 'zod';

export const emailSchema = z
  .string({ required_error: 'Email is required', invalid_type_error: 'Email must be a string' })
  .trim()
  .email('Email must be a valid email address')
  .max(254, 'Email is too long');

export const passwordSchema = z
  .string({ required_error: 'Password is required', invalid_type_error: 'Password must be a string' })
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter')
  .regex(/[0-9]/, 'Password must include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character');

export const idParamSchema = z
  .string({ required_error: 'ID is required', invalid_type_error: 'ID must be a string' })
  .trim()
  .uuid('ID must be a valid UUID');

export const paginationSchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'Page must be a number' })
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'Limit must be a number' })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

export const idQuerySchema = z.object({
  id: idParamSchema,
});

export const safeObjectSchema = z.record(z.any()).transform((value) => value ?? {});
