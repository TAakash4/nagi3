import { execSync } from "child_process";
import { logger } from "./logger";

export async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  try {
    logger.info("Running database migrations...");

    // Run migration files in order
    const migrations = ["0000_conversation_history.sql", "0001_memory_candidates.sql"];

    for (const migration of migrations) {
      logger.info(`Running migration: ${migration}`);
      execSync(`psql "$DATABASE_URL" -f migrations/${migration}`, {
        stdio: "inherit",
      });
    }

    logger.info("Migrations completed successfully");
  } catch (error) {
    logger.error("Migration failed:", error);
    throw error;
  }
}
