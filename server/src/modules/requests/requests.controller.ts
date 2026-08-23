import { Request, Response } from 'express';
import { z } from 'zod';
import { requestsService } from './requests.service';
import { createRequestSchema } from './requests.validation';
import { reviewSchema } from './requests.validation';
import { reviewsService } from './reviews.service';

const errorResponse = (res: Response, error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  const errors: Record<string, { status: number; message: string }> = {
    SELF_REQUEST: { status: 400, message: 'You cannot send a request to yourself.' },
    RECEIVER_NOT_FOUND: { status: 404, message: 'The receiving user could not be found.' },
    SKILL_NOT_FOUND: { status: 404, message: 'The requested skill could not be found.' },
    SKILL_NOT_OWNED_BY_RECEIVER: { status: 400, message: 'The requested skill does not belong to the receiving user.' },
    SKILL_INACTIVE: { status: 409, message: 'Inactive skills cannot receive requests.' },
    USERS_BLOCKED: { status: 403, message: 'Requests cannot be sent between blocked users.' },
    DUPLICATE_PENDING_REQUEST: { status: 409, message: 'A pending request already exists for this skill.' },
    REQUEST_NOT_FOUND: { status: 404, message: 'The request could not be found.' },
    FORBIDDEN: { status: 403, message: 'You are not authorized to perform this action.' },
    INVALID_STATE_TRANSITION: { status: 409, message: 'The request is not in a state that allows this action.' },
  };
  const known = errors[code];
  return res.status(known?.status ?? 500).json({ success: false, error: { code: known ? code : 'INTERNAL_SERVER_ERROR', message: known?.message ?? 'Unable to process the request.' } });
};

const requireUser = (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return null;
  }
  return userId;
};

const getRequestId = (req: Request) => {
  const requestId = req.params.id;
  return Array.isArray(requestId) ? requestId[0] : requestId;
};

export const requestsController = {
  list: async (req: Request, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const requests = await requestsService.listRequests(userId);
      return res.status(200).json({ success: true, data: requests });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },

  create: async (req: Request, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const payload = createRequestSchema.parse(req.body);
      const request = await requestsService.createRequest({ ...payload, senderId: userId });
      return res.status(201).json({ success: true, data: request });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: error.issues } });
      }
      return errorResponse(res, error);
    }
  },

  get: async (req: Request, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const request = await requestsService.getRequest(userId, getRequestId(req));
      return res.status(200).json({ success: true, data: request });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },

  updateStatus: async (req: Request, res: Response, status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED') => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const request = await requestsService.transition(userId, getRequestId(req), status);
      return res.status(200).json({ success: true, data: request });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },

  review: async (req: Request, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const payload = reviewSchema.parse(req.body);
      const review = await reviewsService.create(getRequestId(req), userId, payload.rating, payload.comment);
      return res.status(201).json({ success: true, data: review });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Review validation failed.', issues: error.issues } });
      if (error instanceof Error && error.message === 'REQUEST_NOT_FOUND') return errorResponse(res, error);
      if (error instanceof Error && error.message === 'REQUEST_NOT_COMPLETED') return res.status(409).json({ success: false, error: { code: 'REQUEST_NOT_COMPLETED', message: 'Reviews require a completed exchange.' } });
      if (error instanceof Error && error.message === 'REVIEW_ALREADY_EXISTS') return res.status(409).json({ success: false, error: { code: 'REVIEW_ALREADY_EXISTS', message: 'You already reviewed this exchange.' } });
      return errorResponse(res, error);
    }
  },
};
