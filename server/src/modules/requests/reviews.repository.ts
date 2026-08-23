import prisma from '../../infrastructure/database/prisma';
import { auditService } from '../../infrastructure/audit/audit.service';

export const reviewsRepository = {
  create: async (payload: { requestId: string; authorId: string; recipientId: string; rating: number; comment?: string }) => prisma.$transaction(async (tx) => {
    const review = await tx.review.create({ data: payload });
    await auditService.recordWithClient(tx, { actorUserId: payload.authorId, action: 'REVIEW_SUBMITTED', entityType: 'SkillExchangeRequest', entityId: payload.requestId, payload: { rating: payload.rating, hasComment: Boolean(payload.comment) } });
    return review;
  }),
};
