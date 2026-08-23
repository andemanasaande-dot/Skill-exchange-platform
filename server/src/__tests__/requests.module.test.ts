import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestsRepository } from '../modules/requests/requests.repository';
import { requestsService } from '../modules/requests/requests.service';

const pendingRequest = (overrides = {}) => ({
  id: 'request_1', senderId: 'user_a', receiverId: 'user_b', skillId: 'skill_b', status: 'PENDING', message: null,
  createdAt: new Date(), updatedAt: new Date(), sender: { id: 'user_a', name: 'Alice' }, receiver: { id: 'user_b', name: 'Bob' },
  skill: { id: 'skill_b', title: 'Java', isActive: true, category: { id: 'cat_1', name: 'Programming', slug: 'programming' } },
  ...overrides,
});

describe('SkillExchangeRequest service', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates requests through the repository and rejects self requests', async () => {
    const create = vi.spyOn(requestsRepository, 'create').mockResolvedValue(pendingRequest() as never);
    await expect(requestsService.createRequest({ senderId: 'user_a', receiverId: 'user_b', skillId: 'skill_b', message: 'Teach me Java' })).resolves.toMatchObject({ id: 'request_1' });
    expect(create).toHaveBeenCalledWith({ senderId: 'user_a', receiverId: 'user_b', skillId: 'skill_b', message: 'Teach me Java' });
    await expect(requestsService.createRequest({ senderId: 'user_a', receiverId: 'user_a', skillId: 'skill_b' })).rejects.toThrow('SELF_REQUEST');
  });

  it('allows only the receiver to accept or reject pending requests', async () => {
    vi.spyOn(requestsRepository, 'findById').mockResolvedValue(pendingRequest() as never);
    const transition = vi.spyOn(requestsRepository, 'transition').mockResolvedValue(pendingRequest({ status: 'ACCEPTED' }) as never);

    await expect(requestsService.transition('user_b', 'request_1', 'ACCEPTED')).resolves.toMatchObject({ status: 'ACCEPTED' });
    expect(transition).toHaveBeenCalledWith('request_1', 'PENDING', 'ACCEPTED', 'user_b');
    await expect(requestsService.transition('user_a', 'request_1', 'REJECTED')).rejects.toThrow('FORBIDDEN');
  });

  it('allows only the sender to cancel a pending request', async () => {
    vi.spyOn(requestsRepository, 'findById').mockResolvedValue(pendingRequest() as never);
    const transition = vi.spyOn(requestsRepository, 'transition').mockResolvedValue(pendingRequest({ status: 'CANCELLED' }) as never);

    await expect(requestsService.transition('user_a', 'request_1', 'CANCELLED')).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(transition).toHaveBeenCalledWith('request_1', 'PENDING', 'CANCELLED', 'user_a');
    await expect(requestsService.transition('user_b', 'request_1', 'CANCELLED')).rejects.toThrow('FORBIDDEN');
  });

  it('allows either participant to complete an accepted request', async () => {
    vi.spyOn(requestsRepository, 'findById').mockResolvedValue(pendingRequest({ status: 'ACCEPTED' }) as never);
    const transition = vi.spyOn(requestsRepository, 'transition').mockResolvedValue(pendingRequest({ status: 'COMPLETED' }) as never);

    await expect(requestsService.transition('user_a', 'request_1', 'COMPLETED')).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(transition).toHaveBeenCalledWith('request_1', 'ACCEPTED', 'COMPLETED', 'user_a');
    await expect(requestsService.transition('user_x', 'request_1', 'COMPLETED')).rejects.toThrow('FORBIDDEN');
  });

  it('rejects invalid state transitions', async () => {
    vi.spyOn(requestsRepository, 'findById').mockResolvedValue(pendingRequest({ status: 'REJECTED' }) as never);
    await expect(requestsService.transition('user_b', 'request_1', 'COMPLETED')).rejects.toThrow('INVALID_STATE_TRANSITION');

    vi.spyOn(requestsRepository, 'findById').mockResolvedValue(pendingRequest({ status: 'ACCEPTED' }) as never);
    await expect(requestsService.transition('user_b', 'request_1', 'REJECTED')).rejects.toThrow('INVALID_STATE_TRANSITION');
  });

  it('scopes list and detail access to authenticated participants', async () => {
    vi.spyOn(requestsRepository, 'listByUser').mockResolvedValue([pendingRequest()] as never);
    vi.spyOn(requestsRepository, 'findById').mockResolvedValue(pendingRequest() as never);

    await expect(requestsService.listRequests('user_a')).resolves.toHaveLength(1);
    await expect(requestsService.getRequest('user_b', 'request_1')).resolves.toMatchObject({ id: 'request_1' });
    await expect(requestsService.getRequest('user_x', 'request_1')).rejects.toThrow('FORBIDDEN');
  });
});
