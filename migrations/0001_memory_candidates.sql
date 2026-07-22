CREATE TABLE IF NOT EXISTS "conversation_history" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "role" text NOT NULL CHECK ("role" IN ('user', 'assistant')),
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "memories" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "memories"
  ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'profile';

CREATE TABLE IF NOT EXISTS "memory_candidates" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "type" text NOT NULL CHECK ("type" IN ('value', 'principle', 'goal', 'learning', 'profile')),
  "content" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'saved', 'dismissed')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "memory_candidates_chat_status_idx"
  ON "memory_candidates" ("chat_id", "status");
