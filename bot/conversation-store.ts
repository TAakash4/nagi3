import { and, desc, eq } from "drizzle-orm";

import {
  conversationHistoryTable,
  db,
  memoriesTable,
  preferencesTable,
  projectsTable,
} from "../db";

export async function loadHistory(
  chatId: number,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const rows = await db
    .select()
    .from(conversationHistoryTable)
    .where(eq(conversationHistoryTable.chatId, chatId))
    .orderBy(desc(conversationHistoryTable.createdAt))
    .limit(40);
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

export async function appendMessage(
  chatId: number,
  role: "user" | "assistant",
  content: string,
): Promise<number> {
  const [message] = await db.insert(conversationHistoryTable).values({ chatId, role, content }).returning({
    id: conversationHistoryTable.id,
  });
  if (!message) throw new Error("Failed to save conversation message");
  return message.id;
}

export async function clearHistory(chatId: number): Promise<void> {
  await db.delete(conversationHistoryTable).where(eq(conversationHistoryTable.chatId, chatId));
}

export async function loadMemories(chatId: number): Promise<string[]> {
  const rows = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.chatId, chatId))
    .orderBy(desc(memoriesTable.createdAt));
  return rows.map((r) => r.content);
}

export async function loadPreferences(chatId: number): Promise<Array<{ key: string; value: string }>> {
  return db.select({ key: preferencesTable.key, value: preferencesTable.value })
    .from(preferencesTable)
    .where(and(eq(preferencesTable.chatId, chatId), eq(preferencesTable.enabled, true)))
    .orderBy(preferencesTable.key);
}

export async function loadProjects(chatId: number) {
  return db.select().from(projectsTable).where(and(
    eq(projectsTable.chatId, chatId),
    eq(projectsTable.status, "active"),
  )).orderBy(desc(projectsTable.updatedAt));
}

export function japanDate(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
