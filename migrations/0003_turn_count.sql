CREATE TABLE IF NOT EXISTS "turn_count" (
  "chat_id" bigint PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
