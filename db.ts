import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { conversationHistoryTable } from "./conversation-history";
import { memoriesTable } from "./memories";
import { memoryCandidatesTable } from "./memory-candidates";
import { conversationFeedbackTable } from "./conversation-feedback";
import { preferencesTable } from "./preferences";
import { projectsTable } from "./projects";
import { summariesTable } from "./summaries";
import { turnCountTable } from "./turn-count";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const pool = new Pool({ connectionString });
export const db = drizzle(pool);
export async function closeDatabase(): Promise<void> {
  await pool.end();
}
export {
  conversationFeedbackTable,
  conversationHistoryTable,
  memoriesTable,
  memoryCandidatesTable,
  preferencesTable,
  projectsTable,
  summariesTable,
  turnCountTable,
};
