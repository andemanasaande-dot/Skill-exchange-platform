CREATE TABLE "SavedSkill" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedSkill_userId_skillId_key" ON "SavedSkill"("userId", "skillId");
CREATE INDEX "SavedSkill_userId_createdAt_idx" ON "SavedSkill"("userId", "createdAt");
CREATE INDEX "SavedSkill_skillId_idx" ON "SavedSkill"("skillId");

ALTER TABLE "SavedSkill" ADD CONSTRAINT "SavedSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedSkill" ADD CONSTRAINT "SavedSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
