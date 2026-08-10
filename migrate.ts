import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

import { logger } from "./logger";

export async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const migrationsUrl = new URL("./migrations/", import.meta.url);
  const migrationFiles = (await readdir(migrationsUrl))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const client = new Client({ connectionString });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    for (const migrationFile of migrationFiles) {
      const applied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [migrationFile],
      );
      if (applied.rowCount && applied.rowCount > 0) continue;

      const migrationUrl = new URL(migrationFile, migrationsUrl);
      const sql = await readFile(fileURLToPath(migrationUrl), "utf8");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [migrationFile],
      );
      logger.info({ migrationFile }, "Database migration completed");
    }
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
