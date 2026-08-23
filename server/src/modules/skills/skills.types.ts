export type SkillRecord = {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
