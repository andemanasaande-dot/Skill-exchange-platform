import { z } from 'zod';

export const userIdSchema = z.object({
  id: z
    .string({ required_error: 'User ID is required', invalid_type_error: 'User ID must be a string' })
    .trim()
    .min(1, 'User ID is required'),
});

export const updateProfileSchema = z
  .object({
    name: z
      .string({ required_error: 'Name is required', invalid_type_error: 'Name must be a string' })
      .trim()
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    bio: z
      .string({ invalid_type_error: 'Bio must be a string' })
      .max(500, 'Bio cannot exceed 500 characters')
      .optional()
      .transform((value) => (value === undefined ? value : value.trim() || null)),
    location: z
      .string({ invalid_type_error: 'Location must be a string' })
      .max(100, 'Location cannot exceed 100 characters')
      .optional()
      .transform((value) => (value === undefined ? value : value.trim() || null)),
    avatarUrl: z
      .string({ invalid_type_error: 'Avatar URL must be a string' })
      .trim()
      .url('Avatar URL must be a valid URL')
      .max(2048, 'Avatar URL is too long')
      .optional()
      .or(z.literal(''))
      .transform((value) => (value === '' ? null : value)),
  })
  .passthrough()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one profile field must be provided.',
    path: ['value'],
  });
