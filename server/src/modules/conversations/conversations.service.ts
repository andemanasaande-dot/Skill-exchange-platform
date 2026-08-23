import { conversationsRepository } from './conversations.repository';

export const conversationsService = {
  listConversations: (userId: string) => conversationsRepository.listByUser(userId),
  getConversation: async (userId: string, id: string) => {
    const conversation = await conversationsRepository.getById(id);
    if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
    if (conversation.userAId !== userId && conversation.userBId !== userId) throw new Error('FORBIDDEN');
    return conversation;
  },
  createForAcceptedRequest: async (request: { id: string; senderId: string; receiverId: string; status: string }) => {
    if (request.status !== 'ACCEPTED') throw new Error('REQUEST_NOT_ACCEPTED');
    return conversationsRepository.createForAcceptedRequest(request);
  },
};
