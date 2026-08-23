import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '../infrastructure/events/event-bus';

describe('in-process domain event bus', () => {
  afterEach(() => eventBus.clear());

  it('publishes typed events to subscribers', async () => {
    const handler = vi.fn();
    eventBus.subscribe('request.accepted', handler);

    await eventBus.publish('request.accepted', {
      requestId: 'request_1', senderId: 'user_a', receiverId: 'user_b', skillId: 'skill_1',
      status: 'ACCEPTED', actorUserId: 'user_b', previousStatus: 'PENDING',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({ type: 'request.accepted', payload: { requestId: 'request_1', status: 'ACCEPTED' } });
    expect(handler.mock.calls[0][0].occurredAt).toEqual(expect.any(String));
  });

  it('isolates subscriber failures so later handlers still execute', async () => {
    const failedHandler = vi.fn().mockRejectedValue(new Error('notification failed'));
    const successfulHandler = vi.fn();
    eventBus.subscribe('message.sent', failedHandler);
    eventBus.subscribe('message.sent', successfulHandler);

    await expect(eventBus.publish('message.sent', { messageId: 'message_1', conversationId: 'conversation_1', senderId: 'user_a', content: 'Hello', createdAt: new Date().toISOString() })).resolves.toBeUndefined();
    expect(failedHandler).toHaveBeenCalledOnce();
    expect(successfulHandler).toHaveBeenCalledOnce();
  });

  it('supports unsubscribe without affecting other event types', async () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe('profile.updated', handler);
    unsubscribe();

    await eventBus.publish('profile.updated', { userId: 'user_a', changedFields: ['bio'] });

    expect(handler).not.toHaveBeenCalled();
  });
});
