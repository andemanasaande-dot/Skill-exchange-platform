import { requestsRepository } from './requests.repository';
import { reviewsRepository } from './reviews.repository';
import { eventBus } from '../../infrastructure/events/event-bus';

export const reviewsService = {
  create: async (requestId: string, authorId: string, rating: number, comment?: string) => {
    const request = await requestsRepository.findById(requestId);
    if (!request) throw new Error('REQUEST_NOT_FOUND');
    if (request.status !== 'COMPLETED') throw new Error('REQUEST_NOT_COMPLETED');
    if (request.senderId !== authorId && request.receiverId !== authorId) throw new Error('FORBIDDEN');
    const recipientId = request.senderId === authorId ? request.receiverId : request.senderId;
    try {
      const review = await reviewsRepository.create({ requestId, authorId, recipientId, rating, comment });
      await eventBus.publish('review.created', {
        reviewId: review.id,
        requestId,
        authorId,
        recipientId,
        rating,
      });
      return review;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new Error('REVIEW_ALREADY_EXISTS');
      throw error;
    }
  },
};
