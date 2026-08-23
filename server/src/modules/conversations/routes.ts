import { Router } from 'express';
import { conversationsController } from './conversations.controller';
import { validateParams } from '../../middleware/validation.middleware';
import { conversationIdSchema } from './conversations.validation';

export const createConversationsRouter = () => {
  const router = Router();

  router.get('/', conversationsController.list);
  router.get('/:id', validateParams(conversationIdSchema), conversationsController.getById);

  return router;
};
