import { Router } from 'express';
import { recommendationsController } from './recommendations.controller';

export const createRecommendationsRouter = () => {
  const router = Router();

  router.get('/users', recommendationsController.listUsers);

  return router;
};
