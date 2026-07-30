CREATE TABLE IF NOT EXISTS "preferences" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "source" text NOT NULL DEFAULT 'explicit' CHECK ("source" IN ('explicit', 'approved', 'default')),
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "preferences_chat_key_idx" ON "preferences" ("chat_id", "key");

CREATE TABLE IF NOT EXISTS "projects" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'paused', 'completed', 'archived')),
  "current_focus" text,
  "next_action" text,
  "progress_percent" integer CHECK ("progress_percent" BETWEEN 0 AND 100),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "projects_chat_name_idx" ON "projects" ("chat_id", "name");

CREATE TABLE IF NOT EXISTS "summaries" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "period_type" text NOT NULL DEFAULT 'daily' CHECK ("period_type" IN ('daily', 'weekly')),
  "period_start" date NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "summaries_chat_period_idx" ON "summaries" ("chat_id", "period_type", "period_start");

CREATE TABLE IF NOT EXISTS "conversation_feedback" (
  "id" serial PRIMARY KEY,
  "chat_id" bigint NOT NULL,
  "assistant_message_id" integer NOT NULL REFERENCES "conversation_history" ("id") ON DELETE CASCADE,
  "empathy_first_score" integer NOT NULL CHECK ("empathy_first_score" BETWEEN 1 AND 5),
  "summary_quality_score" integer NOT NULL CHECK ("summary_quality_score" BETWEEN 1 AND 5),
  "question_necessity_score" integer NOT NULL CHECK ("question_necessity_score" BETWEEN 1 AND 5),
  "preference_compliance_score" integer NOT NULL CHECK ("preference_compliance_score" BETWEEN 1 AND 5),
  "issue_tags" text[] NOT NULL DEFAULT '{}',
  "rationale" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_feedback_message_idx" ON "conversation_feedback" ("assistant_message_id");
