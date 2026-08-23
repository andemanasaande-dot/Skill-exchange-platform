import { requestsRepository } from './requests.repository';
import { eventBus } from '../../infrastructure/events/event-bus';

type RequestStatus = 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export const requestsService = {
  listRequests: (userId: string) => requestsRepository.listByUser(userId),
  getRequest: async (userId: string, id: string) => {
    const request = await requestsRepository.findById(id);
    if (!request) throw new Error('REQUEST_NOT_FOUND');
    if (request.senderId !== userId && request.receiverId !== userId) throw new Error('FORBIDDEN');
    return request;
  },
  createRequest: async (payload: { senderId: string; receiverId: string; skillId: string; message?: string }) => {
    if (payload.senderId === payload.receiverId) throw new Error('SELF_REQUEST');
    const request = await requestsRepository.create(payload);
    await eventBus.publish('request.created', {
      requestId: request.id,
      senderId: request.senderId,
      receiverId: request.receiverId,
      skillId: request.skillId,
      status: 'PENDING',
    });
    return request;
  },
  transition: async (actorUserId: string, id: string, status: RequestStatus) => {
    const request = await requestsRepository.findById(id);
    if (!request) throw new Error('REQUEST_NOT_FOUND');

    if ((status !== 'COMPLETED' && request.status !== 'PENDING') || (status === 'COMPLETED' && request.status !== 'ACCEPTED')) {
      throw new Error('INVALID_STATE_TRANSITION');
    }

    if (status === 'ACCEPTED' || status === 'REJECTED') {
      if (request.receiverId !== actorUserId) throw new Error('FORBIDDEN');
      const updated = await requestsRepository.transition(id, 'PENDING', status, actorUserId);
      await publishTransitionEvent(status, updated, actorUserId, 'PENDING');
      return updated;
    }
    if (status === 'CANCELLED') {
      if (request.senderId !== actorUserId) throw new Error('FORBIDDEN');
      const updated = await requestsRepository.transition(id, 'PENDING', status, actorUserId);
      await publishTransitionEvent(status, updated, actorUserId, 'PENDING');
      return updated;
    }

    if (request.senderId !== actorUserId && request.receiverId !== actorUserId) throw new Error('FORBIDDEN');
    const updated = await requestsRepository.transition(id, 'ACCEPTED', status, actorUserId);
    await publishTransitionEvent(status, updated, actorUserId, 'ACCEPTED');
    return updated;
  },
};

const publishTransitionEvent = async (
  status: RequestStatus,
  request: { id: string; senderId: string; receiverId: string; skillId: string },
  actorUserId: string,
  previousStatus: 'PENDING' | 'ACCEPTED',
) => {
  const payload = { requestId: request.id, senderId: request.senderId, receiverId: request.receiverId, skillId: request.skillId, actorUserId, previousStatus };
  if (status === 'ACCEPTED') return eventBus.publish('request.accepted', { ...payload, status, previousStatus: 'PENDING' });
  if (status === 'REJECTED') return eventBus.publish('request.rejected', { ...payload, status, previousStatus: 'PENDING' });
  if (status === 'CANCELLED') return eventBus.publish('request.cancelled', { ...payload, status, previousStatus: 'PENDING' });
  return eventBus.publish('request.completed', { ...payload, status, previousStatus: 'ACCEPTED' });
};
