import { Request, Response } from 'express';
import { conversationsService } from './conversations.service';

const getUserId = (req: Request, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return null;
  }
  return req.user.id;
};

export const conversationsController = {
  list: async (req: Request, res: Response) => {
    const userId = getUserId(req, res);
    if (!userId) return;
    try {
      const conversations = await conversationsService.listConversations(userId);
      return res.status(200).json({ success: true, data: conversations });
    } catch (_error) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to retrieve conversations.' } });
    }
  },

  getById: async (req: Request, res: Response) => {
    const userId = getUserId(req, res);
    if (!userId) return;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const conversation = await conversationsService.getConversation(userId, conversationId);
      return res.status(200).json({ success: true, data: conversation });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'CONVERSATION_NOT_FOUND') return res.status(404).json({ success: false, error: { code: 'CONVERSATION_NOT_FOUND', message: 'The conversation could not be found.' } });
      if (error instanceof Error && error.message === 'FORBIDDEN') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You are not a participant in this conversation.' } });
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to retrieve conversation.' } });
    }
  },
};
