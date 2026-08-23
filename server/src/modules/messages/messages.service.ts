import { eventBus } from '../../infrastructure/events/event-bus';
import { log, metrics, trackError } from '../../infrastructure/observability/observability';
import { messagesRepository } from './messages.repository';

export const messagesService = {
  listMessages: async (userId: string, conversationId: string, page: number, limit: number, cursor?: string) => {
    if (!await messagesRepository.findAuthorizedConversation(conversationId, userId)) throw new Error('FORBIDDEN');
    const result = await messagesRepository.listByConversation(conversationId, page, limit, cursor);
    const pagination: Record<string, unknown> = { page, limit, total: result.total, totalPages: result.total === undefined ? undefined : Math.ceil(result.total / limit) };
    if (result.hasMore !== undefined) pagination.hasMore = result.hasMore;
    if (result.nextCursor) pagination.nextCursor = result.nextCursor;
    return { data: result.messages, pagination };
  },
  createMessage: async (payload: { content: string; conversationId: string; senderId: string }) => {
    const conversation = await messagesRepository.findAuthorizedConversation(payload.conversationId, payload.senderId);
    if (!conversation) {
      metrics.message('error');
      throw new Error('FORBIDDEN');
    }
    const message = await messagesRepository.create(payload);
    metrics.message('sent');
    log.info('Message persisted.', { messageId: message.id, conversationId: message.conversationId, senderId: message.senderId });
    await eventBus.publish('message.sent', {
      messageId: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      recipientIds: [conversation.userAId, conversation.userBId].filter((id) => id !== message.senderId),
    });
    return message;
  },
  markRead: async (userId: string, messageId: string) => messagesRepository.markRead(messageId, userId),
};
