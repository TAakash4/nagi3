import { pgTable, text, serial, bigint, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationHistoryTable = pgTable("conversation_history", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConversationHistorySchema = createInsertSchema(
  conversationHistoryTable
).omit({ id: true, createdAt: true });

export type InsertConversationHistory = z.infer<typeof insertConversationHistorySchema>;
export type ConversationHistory = typeof conversationHistoryTable.$inferSelect;
