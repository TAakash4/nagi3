import express from "express";
import { sql } from "drizzle-orm";

import { db } from "./db";

const app = express();
app.get("/health", async (_request, response) => {
  try {
    await db.execute(sql`select 1`);
    response.json({ ok: true });
  } catch {
    response.status(503).json({ ok: false });
  }
});

export default app;
