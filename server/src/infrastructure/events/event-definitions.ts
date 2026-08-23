export type RequestEventPayload = {
  requestId: string;
  senderId: string;
  receiverId: string;
  skillId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  actorUserId?: string;
  previousStatus?: 'PENDING' | 'ACCEPTED';
};

export type DomainEventMap = {
  'request.created': RequestEventPayload & { status: 'PENDING' };
  'request.accepted': RequestEventPayload & { status: 'ACCEPTED'; actorUserId: string; previousStatus: 'PENDING' };
  'request.rejected': RequestEventPayload & { status: 'REJECTED'; actorUserId: string; previousStatus: 'PENDING' };
  'request.cancelled': RequestEventPayload & { status: 'CANCELLED'; actorUserId: string; previousStatus: 'PENDING' };
  'request.completed': RequestEventPayload & { status: 'COMPLETED'; actorUserId: string; previousStatus: 'ACCEPTED' };
  'message.sent': {
    messageId: string;
    conversationId: string;
    senderId: string;
    content: string;
    createdAt: string;
    recipientIds?: string[];
  };
  'moderation.flagged': {
    reportId: string;
    reporterId: string;
    targetUserId?: string;
    reason: string;
  };
  'profile.updated': {
    userId: string;
    changedFields: string[];
  };
};

export type DomainEventType = keyof DomainEventMap;

export type DomainEvent<T extends DomainEventType = DomainEventType> = {
  type: T;
  payload: DomainEventMap[T];
  occurredAt: string;
};
