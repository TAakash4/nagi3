import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

import { logger } from "./logger";

export async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const migrationUrl = new URL("./migrations/0001_memory_candidates.sql", import.meta.url);
  const sql = await readFile(fileURLToPath(migrationUrl), "utf8");
  const client = new Client({ connectionString });

  await client.connect();
  try {
    await client.query(sql);
    logger.info("Database migrations completed");
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations().catch((error: unknown) => {
    logger.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Database migration failed");
    process.exitCode = 1;
  });
}
