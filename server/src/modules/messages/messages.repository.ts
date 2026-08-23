import prisma from '../../infrastructure/database/prisma';

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  readAt: true,
  sender: { select: { id: true, name: true } },
} as const;

export const messagesRepository = {
  findAuthorizedConversation: (conversationId: string, userId: string) => prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }], request: { status: 'ACCEPTED' } },
    select: { id: true, userAId: true, userBId: true },
  }),

  listByConversation: async (conversationId: string, page: number, limit: number, cursor?: string) => {
    const baseWhere = { conversationId, deletedAt: null };
    if (cursor) {
      let decoded: { createdAt: string; id: string };
      try {
        decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { createdAt: string; id: string };
        if (!decoded.id || Number.isNaN(new Date(decoded.createdAt).getTime())) throw new Error('invalid cursor');
      } catch {
        throw new Error('INVALID_CURSOR');
      }
      const where = { ...baseWhere, OR: [{ createdAt: { lt: new Date(decoded.createdAt) } }, { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } }] };
      const messages = await prisma.message.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, select: messageSelect });
      const hasMore = messages.length > limit;
      const pageMessages = messages.slice(0, limit);
      return { messages: pageMessages, total: undefined, hasMore, nextCursor: hasMore ? Buffer.from(JSON.stringify({ createdAt: pageMessages[pageMessages.length - 1].createdAt.toISOString(), id: pageMessages[pageMessages.length - 1].id })).toString('base64url') : undefined };
    }
    const [total, messages] = await prisma.$transaction([
      prisma.message.count({ where: baseWhere }),
      prisma.message.findMany({ where: baseWhere, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit, select: messageSelect }),
    ]);
    return { messages, total, hasMore: messages.length === limit, nextCursor: undefined };
  },

  create: (payload: { conversationId: string; senderId: string; content: string }) => prisma.message.create({ data: payload, select: messageSelect }),

  markRead: async (messageId: string, userId: string) => {
    const result = await prisma.message.updateMany({
      where: { id: messageId, readAt: null, conversation: { OR: [{ userAId: userId }, { userBId: userId }], request: { status: 'ACCEPTED' } } },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const message = await prisma.message.findFirst({ where: { id: messageId, conversation: { OR: [{ userAId: userId }, { userBId: userId }] } }, select: { id: true } });
      if (!message) throw new Error('MESSAGE_NOT_FOUND');
    }
    const message = await prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true } });
    return message?.conversationId;
  },
};
