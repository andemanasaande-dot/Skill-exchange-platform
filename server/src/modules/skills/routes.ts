import { Router } from 'express';
import { validateQuery } from '../../middleware/validation.middleware';
import { skillsController } from './skills.controller';
import { skillDiscoveryQuerySchema } from './skills.discovery.validation';

export const createSkillsRouter = () => {
  const router = Router();

  router.get('/categories', skillsController.categories);
  router.get('/saved', skillsController.saved);
  router.post('/:id/save', skillsController.save);
  router.delete('/:id/save', skillsController.unsave);
  router.get('/', validateQuery(skillDiscoveryQuerySchema), skillsController.list);
  router.post('/', skillsController.create);
  router.get('/:id', skillsController.get);
  router.put('/:id', skillsController.update);
  router.delete('/:id', skillsController.remove);

  return router;
};
