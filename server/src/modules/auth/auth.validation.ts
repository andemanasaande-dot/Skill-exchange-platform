import { z } from 'zod';
import { emailSchema, passwordSchema } from '../../validation/schemas';

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required', invalid_type_error: 'Name must be a string' })
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name cannot exceed 100 characters'),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string({ required_error: 'Verification token is required' }).min(1, 'Verification token is required'),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string({ required_error: 'Reset token is required' }).min(1, 'Reset token is required'),
  password: passwordSchema,
});
