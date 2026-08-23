export type MessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
};
