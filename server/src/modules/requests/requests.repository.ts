import prisma from '../../infrastructure/database/prisma';
import { auditService } from '../../infrastructure/audit/audit.service';

const requestSelect = {
  id: true,
  senderId: true,
  receiverId: true,
  skillId: true,
  status: true,
  message: true,
  createdAt: true,
  updatedAt: true,
  sender: { select: { id: true, name: true } },
  receiver: { select: { id: true, name: true } },
  skill: { select: { id: true, title: true, isActive: true, category: { select: { id: true, name: true, slug: true } } } },
} as const;

export const requestsRepository = {
  listByUser: (userId: string) => prisma.skillExchangeRequest.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: requestSelect,
  }),

  findById: (id: string) => prisma.skillExchangeRequest.findUnique({ where: { id }, select: requestSelect }),

  create: async (payload: { senderId: string; receiverId: string; skillId: string; message?: string }) => prisma.$transaction(async (tx) => {
    const [receiver, skill, blocked] = await Promise.all([
      tx.user.findUnique({ where: { id: payload.receiverId }, select: { id: true, status: true } }),
      tx.skill.findUnique({ where: { id: payload.skillId }, select: { id: true, userId: true, isActive: true } }),
      tx.userBlock.findFirst({ where: { OR: [{ blockerId: payload.senderId, blockedId: payload.receiverId }, { blockerId: payload.receiverId, blockedId: payload.senderId }] }, select: { id: true } }),
    ]);
    if (!receiver) throw new Error('RECEIVER_NOT_FOUND');
    if (!skill) throw new Error('SKILL_NOT_FOUND');
    if (skill.userId !== payload.receiverId) throw new Error('SKILL_NOT_OWNED_BY_RECEIVER');
    if (!skill.isActive) throw new Error('SKILL_INACTIVE');
    if (blocked) throw new Error('USERS_BLOCKED');

    const duplicate = await tx.skillExchangeRequest.findFirst({ where: { senderId: payload.senderId, receiverId: payload.receiverId, skillId: payload.skillId, status: 'PENDING' }, select: { id: true } });
    if (duplicate) throw new Error('DUPLICATE_PENDING_REQUEST');

    const request = await tx.skillExchangeRequest.create({ data: { ...payload, status: 'PENDING' }, select: requestSelect });
    await auditService.recordWithClient(tx, { actorUserId: payload.senderId, action: 'REQUEST_CREATED', entityType: 'SkillExchangeRequest', entityId: request.id, payload: { from: null, to: 'PENDING' } });
    return request;
  }),

  transition: async (id: string, from: 'PENDING' | 'ACCEPTED', to: 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED', actorUserId: string) => prisma.$transaction(async (tx) => {
    const updated = await tx.skillExchangeRequest.updateMany({ where: { id, status: from }, data: { status: to } });
    if (updated.count !== 1) throw new Error('INVALID_STATE_TRANSITION');
    const request = await tx.skillExchangeRequest.findUniqueOrThrow({ where: { id }, select: requestSelect });
    if (to === 'ACCEPTED') {
      const [userAId, userBId] = [request.senderId, request.receiverId].sort();
      await tx.conversation.upsert({
        where: { requestId: id },
        create: { requestId: id, userAId, userBId },
        update: {},
      });
    }
    await auditService.recordWithClient(tx, { actorUserId, action: `REQUEST_${to}`, entityType: 'SkillExchangeRequest', entityId: id, payload: { from, to } });
    return request;
  }),
};
