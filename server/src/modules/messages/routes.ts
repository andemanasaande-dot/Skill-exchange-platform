import { Router } from 'express';
import { validateParams, validateQuery } from '../../middleware/validation.middleware';
import { messagesController } from './messages.controller';
import { messageConversationIdSchema, messageIdSchema, messageQuerySchema } from './messages.validation';

export const createMessagesRouter = () => {
  const router = Router();

  router.get('/:id/messages', validateParams(messageConversationIdSchema), validateQuery(messageQuerySchema), messagesController.list);
  router.post('/:id/messages', validateParams(messageConversationIdSchema), messagesController.create);

  return router;
};

export const createMessageReadRouter = () => {
  const router = Router();
  router.put('/:id/read', validateParams(messageIdSchema), messagesController.markRead);
  return router;
};
