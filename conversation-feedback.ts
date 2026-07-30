import { bigint, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const conversationFeedbackTable = pgTable("conversation_feedback", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  assistantMessageId: integer("assistant_message_id").notNull(),
  empathyFirstScore: integer("empathy_first_score").notNull(),
  summaryQualityScore: integer("summary_quality_score").notNull(),
  questionNecessityScore: integer("question_necessity_score").notNull(),
  preferenceComplianceScore: integer("preference_compliance_score").notNull(),
  issueTags: text("issue_tags").array().notNull().default([]),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConversationFeedback = typeof conversationFeedbackTable.$inferSelect;
