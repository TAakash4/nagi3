import { and, desc, eq, sql } from "drizzle-orm";

import { conversationFeedbackTable, conversationHistoryTable, db, summariesTable } from "../db";
import { looksLikeUnnecessaryQuestion } from "../response-policy";
import { japanDate } from "./conversation-store";
import { openaiClient, textModel } from "./openai-client";
import { stripThinking } from "./prompts";
import { logger } from "../logger";

export async function updateDailySummary(chatId: number): Promise<void> {
  try {
    const today = japanDate();
    const userMessages = await db.select({ content: conversationHistoryTable.content })
      .from(conversationHistoryTable)
      .where(and(
        eq(conversationHistoryTable.chatId, chatId),
        eq(conversationHistoryTable.role, "user"),
        sql`(${conversationHistoryTable.createdAt} AT TIME ZONE 'Asia/Tokyo')::date = ${today}::date`,
      ))
      .orderBy(desc(conversationHistoryTable.createdAt))
      .limit(20);
    if (userMessages.length === 0) return;
    const response = await openaiClient.chat.completions.create({
      model: textModel,
      max_completion_tokens: 180,
      messages: [
        { role: "system", content: "ユーザー本人が述べた事実だけを、日次記録として日本語3項目以内で簡潔に要約してください。推測や助言は含めません。" },
        { role: "user", content: userMessages.reverse().map((message) => message.content).join("\n") },
      ],
    });
    const content = stripThinking(response.choices[0]?.message?.content ?? "").trim();
    if (!content) return;
    await db.insert(summariesTable).values({
      chatId,
      periodType: "daily",
      periodStart: today,
      content,
    }).onConflictDoUpdate({
      target: [summariesTable.chatId, summariesTable.periodType, summariesTable.periodStart],
      set: { content, updatedAt: new Date() },
    });
  } catch (err) {
    logger.warn({ message: err instanceof Error ? err.message : String(err) }, "Daily summary update failed (non-critical)");
  }
}

export async function saveResponseFeedback(
  chatId: number,
  assistantMessageId: number,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  const unnecessaryQuestion = looksLikeUnnecessaryQuestion(userMessage, assistantMessage);
  const issueTags = unnecessaryQuestion ? ["unnecessary_question"] : [];
  const isStatusUpdate = !/[?？]/.test(userMessage);
  const acknowledgesUpdate = assistantMessage.length >= 8 && !unnecessaryQuestion;
  await db.insert(conversationFeedbackTable).values({
    chatId,
    assistantMessageId,
    empathyFirstScore: isStatusUpdate ? (acknowledgesUpdate ? 4 : 2) : 3,
    summaryQualityScore: isStatusUpdate ? (acknowledgesUpdate ? 4 : 2) : 3,
    questionNecessityScore: unnecessaryQuestion ? 2 : 5,
    preferenceComplianceScore: unnecessaryQuestion ? 2 : 5,
    issueTags,
    rationale: unnecessaryQuestion
      ? "明示的な質問ではない発言に対して質問を返した"
      : "不要な質問を示す形式上の問題は検出されなかった",
  }).onConflictDoNothing();
}
