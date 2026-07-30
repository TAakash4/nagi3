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
    for (const migrationFile of migrationFiles) {
      const migrationUrl = new URL(migrationFile, migrationsUrl);
      const sql = await readFile(fileURLToPath(migrationUrl), "utf8");
      await client.query(sql);
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
