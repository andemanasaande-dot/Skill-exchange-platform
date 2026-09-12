import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireRole } from '../../middleware/auth.middleware';
import { validateParams } from '../../middleware/validation.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { z } from 'zod';
import { categoryCreateSchema, categoryUpdateSchema, skillStatusSchema } from './admin.validation';

export const createAdminRouter = () => {
  const router = Router();

  router.get('/dashboard', requireRole('ADMIN'), adminController.dashboard);
  router.get('/users', requireRole('ADMIN'), adminController.users);
  router.get('/users/:id', requireRole('ADMIN'), adminController.user);
  router.put('/users/:id/activate', requireRole('ADMIN'), adminController.activateUser);
  router.get('/categories', requireRole('ADMIN'), adminController.categories);
  router.put('/skills/:id/status', requireRole('ADMIN'), validateParams(z.object({ id: z.string().min(1) })), validateBody(skillStatusSchema), adminController.updateSkillStatus);
  router.post('/categories', requireRole('ADMIN'), validateBody(categoryCreateSchema), adminController.createCategory);
  router.put('/categories/:id', requireRole('ADMIN'), validateParams(z.object({ id: z.string().min(1) })), validateBody(categoryUpdateSchema), adminController.updateCategory);
  router.delete('/categories/:id', requireRole('ADMIN'), validateParams(z.object({ id: z.string().min(1) })), adminController.deleteCategory);

  return router;
};
