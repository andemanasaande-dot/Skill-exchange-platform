export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export type ExchangeRequestRecord = {
  id: string;
  senderId: string;
  receiverId: string;
  skillId: string;
  status: RequestStatus;
  message?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
