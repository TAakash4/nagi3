import { bigint, date, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const summariesTable = pgTable("summaries", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  periodType: text("period_type", { enum: ["daily", "weekly"] }).notNull().default("daily"),
  periodStart: date("period_start").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("summaries_chat_period_idx").on(table.chatId, table.periodType, table.periodStart)]);

export type Summary = typeof summariesTable.$inferSelect;
