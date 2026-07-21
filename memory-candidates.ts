import { bigint, serial, text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const memoryTypes = ["value", "principle", "goal", "learning", "profile"] as const;
export type MemoryType = (typeof memoryTypes)[number];

export const memoryCandidatesTable = pgTable("memory_candidates", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  type: text("type", { enum: memoryTypes }).notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["pending", "saved", "dismissed"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type MemoryCandidate = typeof memoryCandidatesTable.$inferSelect;
