import type { Request, Response } from 'express';
import { z } from 'zod';
import { usersService } from './users.service';
import { updateProfileSchema } from './users.validation';

export const usersController = {
  blockUser: async (req: Request, res: Response) => {
    const blockerId = req.user?.id;
    if (!blockerId) return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    try {
      await usersService.blockUser(blockerId, req.params.id as string);
      return res.status(201).json({ success: true, message: 'User blocked.' });
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : '';
      const known: Record<string, [number, string]> = {
        SELF_BLOCK: [400, 'You cannot block yourself.'],
        USER_NOT_FOUND: [404, 'The requested user could not be found.'],
        BLOCK_ALREADY_EXISTS: [409, 'You have already blocked this user.'],
      };
      const [status, message] = known[code] ?? [500, 'Unable to block this user.'];
      return res.status(status).json({ success: false, error: { code: known[code] ? code : 'INTERNAL_SERVER_ERROR', message } });
    }
  },

  unblockUser: async (req: Request, res: Response) => {
    const blockerId = req.user?.id;
    if (!blockerId) return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    await usersService.unblockUser(blockerId, req.params.id as string);
    return res.status(204).send();
  },

  blockStatus: async (req: Request, res: Response) => {
    const blockerId = req.user?.id;
    if (!blockerId) return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return res.status(200).json({ success: true, data: { blocked: await usersService.isUserBlocked(blockerId, req.params.id as string) } });
  },

  getProfile: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication is required to view your profile.',
          },
        });
      }

      const profile = await usersService.getProfile(userId);
      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'The requested user could not be found.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving the profile.',
        },
      });
    }
  },

  updateProfile: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication is required to update your profile.',
          },
        });
      }

      const payload = updateProfileSchema.parse(req.body);

      const forbiddenKeys = ['id', 'email', 'passwordHash', 'role', 'status', 'emailVerified'];
      const hasForbiddenFields = forbiddenKeys.some((key) => Object.prototype.hasOwnProperty.call(req.body, key));

      if (hasForbiddenFields) {
        throw new z.ZodError([
          {
            code: 'custom',
            path: ['body'],
            message: 'Profile updates cannot modify protected fields.',
          },
        ]);
      }

      const updatedProfile = await usersService.updateProfile(userId, payload);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: updatedProfile,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Profile validation failed.',
            issues: error.issues.map((issue) => ({
              path: issue.path.length ? issue.path.map(String) : ['value'],
              message: issue.message,
            })),
          },
        });
      }

      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'The user could not be found.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the profile.',
        },
      });
    }
  },

  getUserById: async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const profile = await usersService.getPublicProfile(userId);

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'The requested user could not be found.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving the user profile.',
        },
      });
    }
  },

  updateUserById: async (req: Request, res: Response) => {
    try {
      const authenticatedUserId = req.user?.id;
      const targetUserId = req.params.id;

      if (!authenticatedUserId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication is required to update a profile.',
          },
        });
      }

      if (authenticatedUserId !== targetUserId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only update your own profile.',
          },
        });
      }

      const payload = updateProfileSchema.parse(req.body);

      const forbiddenKeys = ['id', 'email', 'passwordHash', 'role', 'status', 'emailVerified'];
      const hasForbiddenFields = forbiddenKeys.some((key) => Object.prototype.hasOwnProperty.call(req.body, key));

      if (hasForbiddenFields) {
        throw new z.ZodError([
          {
            code: 'custom',
            path: ['body'],
            message: 'Profile updates cannot modify protected fields.',
          },
        ]);
      }

      const updatedProfile = await usersService.updateProfile(targetUserId, payload);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: updatedProfile,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Profile validation failed.',
            issues: error.issues.map((issue) => ({
              path: issue.path.length ? issue.path.map(String) : ['value'],
              message: issue.message,
            })),
          },
        });
      }

      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'The user could not be found.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the profile.',
        },
      });
    }
  },
};
