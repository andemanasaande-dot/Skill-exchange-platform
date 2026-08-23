import prisma from '../../infrastructure/database/prisma';

const conversationSelect = {
  id: true,
  requestId: true,
  userAId: true,
  userBId: true,
  createdAt: true,
  updatedAt: true,
  userA: { select: { id: true, name: true } },
  userB: { select: { id: true, name: true } },
  request: { select: { id: true, status: true, skillId: true, skill: { select: { id: true, title: true } } } },
} as const;

export const conversationsRepository = {
  listByUser: (userId: string) => prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: conversationSelect,
  }),
  getById: (id: string) => prisma.conversation.findUnique({ where: { id }, select: conversationSelect }),
  createForAcceptedRequest: (request: { id: string; senderId: string; receiverId: string; status: string }) => {
    if (request.status !== 'ACCEPTED') throw new Error('REQUEST_NOT_ACCEPTED');
    const [userAId, userBId] = [request.senderId, request.receiverId].sort();
    return prisma.conversation.upsert({
      where: { requestId: request.id },
      create: { requestId: request.id, userAId, userBId },
      update: {},
      select: conversationSelect,
    });
  },
};
