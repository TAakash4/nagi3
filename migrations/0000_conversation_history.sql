CREATE TABLE IF NOT EXISTS "conversation_history" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "role" text NOT NULL CHECK ("role" IN ('user', 'assistant')),
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "conversation_history_chat_id_idx"
  ON "conversation_history" ("chat_id");

CREATE TABLE IF NOT EXISTS "memories" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "content" text NOT NULL,
  "type" text NOT NULL DEFAULT 'profile' CHECK ("type" IN ('value', 'principle', 'goal', 'learning', 'profile')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "memories_chat_id_idx"
  ON "memories" ("chat_id");
