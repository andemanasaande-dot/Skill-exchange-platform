import express, { Router } from 'express';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import { interestsController } from './interests.controller';
import { usersController } from './users.controller';
import { createInterestSchema, interestSkillIdSchema } from './interests.validation';
import { userIdSchema, updateProfileSchema } from './users.validation';

export const createUsersRouter = () => {
  const router = Router();

  router.use(express.json());
  router.get('/profile', usersController.getProfile);
  router.put('/profile', validateBody(updateProfileSchema), usersController.updateProfile);
  router.get('/profile/interests', interestsController.list);
  router.post('/profile/interests', validateBody(createInterestSchema), interestsController.add);
  router.delete('/profile/interests/:skillId', validateParams(interestSkillIdSchema), interestsController.remove);
  router.get('/users/:id', validateParams(userIdSchema), usersController.getUserById);
  router.put('/users/:id', validateParams(userIdSchema), validateBody(updateProfileSchema), usersController.updateUserById);

  return router;
};
