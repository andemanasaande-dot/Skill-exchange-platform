export type UserRecord = {
  id: string;
  email: string;
  name?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
