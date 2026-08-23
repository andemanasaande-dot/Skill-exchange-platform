import type { Request, Response } from 'express';
import { z } from 'zod';
import { interestsService } from './interests.service';
import { createInterestSchema } from './interests.validation';

const sendError = (res: Response, error: unknown, action: string) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Interest validation failed.', issues: error.issues },
    });
  }

  const code = error instanceof Error ? error.message : '';
  const knownErrors: Record<string, { status: number; message: string }> = {
    SKILL_NOT_FOUND: { status: 404, message: 'The requested skill could not be found.' },
    SKILL_INACTIVE: { status: 409, message: 'Inactive skills cannot be added as interests.' },
    INTEREST_ALREADY_EXISTS: { status: 409, message: 'You already want to learn this skill.' },
    INTEREST_NOT_FOUND: { status: 404, message: 'The skill is not in your learning interests.' },
  };
  const knownError = knownErrors[code];

  return res.status(knownError?.status ?? 500).json({
    success: false,
    error: { code: knownError ? code : 'INTERNAL_SERVER_ERROR', message: knownError?.message ?? `Unable to ${action} skill interest.` },
  });
};

export const interestsController = {
  list: async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });

    try {
      const interests = await interestsService.list(userId);
      return res.status(200).json({ success: true, data: interests });
    } catch (error: unknown) {
      return sendError(res, error, 'retrieve');
    }
  },

  add: async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });

    try {
      const { skillId } = createInterestSchema.parse(req.body);
      const interest = await interestsService.add(userId, skillId);
      return res.status(201).json({ success: true, data: { interest } });
    } catch (error: unknown) {
      return sendError(res, error, 'add');
    }
  },

  remove: async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });

    try {
      const skillId = req.params.skillId;
      if (Array.isArray(skillId)) {
        throw new z.ZodError([{ code: 'custom', path: ['skillId'], message: 'Skill ID must be a single value.' }]);
      }
      await interestsService.remove(userId, skillId);
      return res.status(204).send();
    } catch (error: unknown) {
      return sendError(res, error, 'remove');
    }
  },
};
