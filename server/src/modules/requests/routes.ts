import { Router } from 'express';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import { requestsController } from './requests.controller';
import { createRequestSchema, requestIdSchema } from './requests.validation';

export const createRequestsRouter = () => {
  const router = Router();

  router.get('/', requestsController.list);
  router.post('/', validateBody(createRequestSchema), requestsController.create);
  router.get('/:id', validateParams(requestIdSchema), requestsController.get);
  router.put('/:id/accept', validateParams(requestIdSchema), (req, res) => requestsController.updateStatus(req, res, 'ACCEPTED'));
  router.put('/:id/reject', validateParams(requestIdSchema), (req, res) => requestsController.updateStatus(req, res, 'REJECTED'));
  router.put('/:id/cancel', validateParams(requestIdSchema), (req, res) => requestsController.updateStatus(req, res, 'CANCELLED'));
  router.put('/:id/complete', validateParams(requestIdSchema), (req, res) => requestsController.updateStatus(req, res, 'COMPLETED'));
  router.post('/:id/review', validateParams(requestIdSchema), requestsController.review);
  return router;
};
