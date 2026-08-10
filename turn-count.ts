import { eq, sql } from "drizzle-orm";
import { bigint, integer, pgTable, timestamp } from "drizzle-orm/pg-core";

import { db } from "./db";

export { shouldRunPeriodicTasks, TURN_INTERVAL } from "./turn-count-logic";

export const turnCountTable = pgTable("turn_count", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export async function incrementTurnCount(chatId: number): Promise<number> {
  const [row] = await db
    .insert(turnCountTable)
    .values({ chatId, count: 1 })
    .onConflictDoUpdate({
      target: turnCountTable.chatId,
      set: {
        count: sql`${turnCountTable.count} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: turnCountTable.count });

  if (!row) throw new Error("Failed to increment turn count");
  return row.count;
}

export async function resetTurnCount(chatId: number): Promise<void> {
  await db
    .insert(turnCountTable)
    .values({ chatId, count: 0 })
    .onConflictDoUpdate({
      target: turnCountTable.chatId,
      set: { count: 0, updatedAt: new Date() },
    });
}
