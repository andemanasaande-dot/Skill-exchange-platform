import type { Request, Response } from 'express';
import { recommendationsService } from './recommendations.service';

export const recommendationsController = {
  listUsers: async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
      });
    }

    try {
      const recommendations = await recommendationsService.getUserRecommendations(userId);
      return res.status(200).json({ success: true, data: recommendations });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'The authenticated user could not be found.' },
        });
      }

      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to calculate user recommendations.' },
      });
    }
  },
};
