import { logger } from '../logger/logger';
import type { DomainEvent, DomainEventMap, DomainEventType } from './event-definitions';

export type DomainEventHandler<T extends DomainEventType> = (event: DomainEvent<T>) => void | Promise<void>;

class InProcessEventBus {
  private readonly handlers = new Map<DomainEventType, Set<DomainEventHandler<DomainEventType>>>();

  subscribe<T extends DomainEventType>(type: T, handler: DomainEventHandler<T>) {
    const eventHandlers = this.handlers.get(type) ?? new Set<DomainEventHandler<DomainEventType>>();
    eventHandlers.add(handler as DomainEventHandler<DomainEventType>);
    this.handlers.set(type, eventHandlers);

    return () => this.unsubscribe(type, handler);
  }

  unsubscribe<T extends DomainEventType>(type: T, handler: DomainEventHandler<T>) {
    this.handlers.get(type)?.delete(handler as DomainEventHandler<DomainEventType>);
  }

  async publish<T extends DomainEventType>(type: T, payload: DomainEventMap[T]) {
    const event: DomainEvent<T> = { type, payload, occurredAt: new Date().toISOString() };
    const eventHandlers = [...(this.handlers.get(type) ?? [])];

    const results = await Promise.allSettled(eventHandlers.map((handler) => handler(event as DomainEvent<DomainEventType>)));
    results.forEach((result) => {
      if (result.status === 'rejected') {
        logger.error(`Domain event handler failed for ${type}.`, { error: result.reason });
      }
    });
  }

  clear() {
    this.handlers.clear();
  }
}

export const eventBus = new InProcessEventBus();
