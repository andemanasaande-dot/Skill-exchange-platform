import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireRole } from '../../middleware/auth.middleware';
import { validateParams } from '../../middleware/validation.middleware';
import { z } from 'zod';

export const createAdminRouter = () => {
  const router = Router();

  router.get('/dashboard', requireRole('ADMIN'), adminController.dashboard);
  router.get('/users', requireRole('ADMIN'), adminController.users);
  router.get('/users/:id', requireRole('ADMIN'), adminController.user);
  router.put('/users/:id/activate', requireRole('ADMIN'), adminController.activateUser);
  router.get('/categories', requireRole('ADMIN'), adminController.categories);

  return router;
};
