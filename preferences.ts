import { bigint, boolean, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const preferencesTable = pgTable("preferences", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  source: text("source", { enum: ["explicit", "approved", "default"] }).notNull().default("explicit"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("preferences_chat_key_idx").on(table.chatId, table.key)]);

export type Preference = typeof preferencesTable.$inferSelect;
