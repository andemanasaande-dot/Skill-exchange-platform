CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Skill_title_trgm_idx"
  ON "Skill" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Skill_description_trgm_idx"
  ON "Skill" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Notification_recipient_created_id_idx"
  ON "Notification" ("recipientId", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "Message_conversation_deleted_created_id_idx"
  ON "Message" ("conversationId", "deletedAt", "createdAt" DESC, "id" DESC);
