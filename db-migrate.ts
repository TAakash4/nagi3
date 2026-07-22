import { db } from "./db";
import { logger } from "./logger";

export async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  try {
    logger.info("Running database migrations...");

    // Migration 0: Create conversation_history and memories tables
    await db.execute(`
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
    `);

    logger.info("Migration 0: conversation_history and memories created");

    // Migration 1: Create memory_candidates table
    await db.execute(`
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
    `);

    logger.info("Migration 1: memory_candidates created");
    logger.info("All migrations completed successfully");
  } catch (error) {
    logger.error({ error }, "Migration failed");
    throw error;
  }
}
