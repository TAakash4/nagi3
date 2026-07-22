import app from "./app";
import { logger } from "./logger";
import { startBot } from "./telegram-bot";
import { runMigrations } from "./db-migrate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    // Run migrations first
    await runMigrations();

    const server = app.listen(port, () => {
      logger.info({ port }, "Server listening");
      startBot();
    });

    server.on("error", (err) => {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    });
  } catch (error) {
    logger.error({ error }, "Failed to start application");
    process.exit(1);
  }
}

start();
