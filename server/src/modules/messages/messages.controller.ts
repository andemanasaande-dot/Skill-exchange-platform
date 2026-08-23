import { Request, Response } from 'express';
import { z } from 'zod';
import { messagesService } from './messages.service';
import { createMessageSchema, messageQuerySchema } from './messages.validation';

const currentUser = (req: Request, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return null;
  }
  return req.user.id;
};

const errorResponse = (res: Response, error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  const known: Record<string, { status: number; message: string }> = {
    FORBIDDEN: { status: 403, message: 'You are not a participant in this conversation.' },
    MESSAGE_NOT_FOUND: { status: 404, message: 'The message could not be found.' },
  };
  const item = known[code];
  return res.status(item?.status ?? 500).json({ success: false, error: { code: item ? code : 'INTERNAL_SERVER_ERROR', message: item?.message ?? 'Unable to process the message.' } });
};

export const messagesController = {
  list: async (req: Request, res: Response) => {
    const userId = currentUser(req, res);
    if (!userId) return;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const query = messageQuerySchema.parse(req.query);
      const result = await messagesService.listMessages(userId, conversationId, query.page, query.limit, query.cursor);
      return res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Message request validation failed.', issues: error.issues } });
      if (error instanceof Error && error.message === 'INVALID_CURSOR') return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid message cursor.' } });
      return errorResponse(res, error);
    }
  },

  create: async (req: Request, res: Response) => {
    const userId = currentUser(req, res);
    if (!userId) return;
    try {
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const payload = createMessageSchema.parse({ ...req.body, conversationId });
      const message = await messagesService.createMessage({ ...payload, senderId: userId });
      return res.status(201).json({ success: true, data: message });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Message content validation failed.', issues: error.issues } });
      }
      return errorResponse(res, error);
    }
  },

  markRead: async (req: Request, res: Response) => {
    const userId = currentUser(req, res);
    if (!userId) return;
    const messageId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      await messagesService.markRead(userId, messageId);
      return res.status(200).json({ success: true, message: 'Message marked as read.' });
    } catch (error: unknown) {
      return errorResponse(res, error);
    }
  },
};
