import { bigint, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "paused", "completed", "archived"] }).notNull().default("active"),
  currentFocus: text("current_focus"),
  nextAction: text("next_action"),
  progressPercent: integer("progress_percent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("projects_chat_name_idx").on(table.chatId, table.name)]);

export type Project = typeof projectsTable.$inferSelect;
