import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { conversationHistoryTable } from "./conversation-history";
import { memoriesTable } from "./memories";
import { memoryCandidatesTable } from "./memory-candidates";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const pool = new Pool({ connectionString });
export const db = drizzle(pool);
export { conversationHistoryTable, memoriesTable, memoryCandidatesTable };
