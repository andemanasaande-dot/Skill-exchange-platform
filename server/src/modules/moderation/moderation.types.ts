export type ModerationStatus = 'open' | 'reviewed' | 'resolved';

export type ModerationRecord = {
  id: string;
  reporterId: string;
  targetUserId?: string | null;
  reason: string;
  status: ModerationStatus;
  createdAt: Date;
};
