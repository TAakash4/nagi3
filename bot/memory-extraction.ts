import type TelegramBot from "node-telegram-bot-api";
import { and, eq } from "drizzle-orm";

import { db, memoriesTable, memoryCandidatesTable } from "../db";
import { memoryTypes, type MemoryType } from "../memory-candidates";
import { logger } from "../logger";
import { loadHistory, loadMemories } from "./conversation-store";
import { openaiClient, textModel } from "./openai-client";

const MEMORY_LABELS: Record<MemoryType, string> = {
  value: "価値観",
  principle: "原則",
  goal: "目標",
  learning: "学び",
  profile: "プロフィール",
};

function isMemoryType(value: unknown): value is MemoryType {
  return typeof value === "string" && memoryTypes.includes(value as MemoryType);
}

export async function extractMemoryCandidate(bot: TelegramBot, chatId: number): Promise<void> {
  try {
    const history = await loadHistory(chatId);
    const transcript = history
      .slice(-12)
      .map((m) => `${m.role === "user" ? "ユーザー" : "凪"}: ${m.content}`)
      .join("\n");

    const existing = await loadMemories(chatId);
    const pending = await db.select().from(memoryCandidatesTable).where(and(
      eq(memoryCandidatesTable.chatId, chatId),
      eq(memoryCandidatesTable.status, "pending"),
    ));
    const known = [...existing, ...pending.map((item) => item.content)];
    const existingSection = known.length > 0
      ? `保存済みまたは確認中の情報:\n${known.map((e) => `・${e}`).join("\n")}\n\n`
      : "";

    const prompt =
      existingSection +
      `以下の会話から、長期記憶にする価値が明確な情報を最大1件抽出してください。\n` +
      `条件：\n` +
      `・一時的な出来事（今日疲れた等）は除外\n` +
      `・本人が述べていない推測は除外\n` +
      `・種類は value / principle / goal / learning / profile のいずれか\n` +
      `・既存または確認中の情報と重複する場合、候補なしにする\n` +
      `・候補がなければ candidate を null にする\n` +
      `JSONのみ返答: { "candidate": { "type": "goal", "content": "..." } | null }\n\n会話:\n${transcript}`;

    const res = await openaiClient.chat.completions.create({
      model: textModel,
      max_completion_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "会話から重要な情報を抽出するAIです。JSONのみ返してください。",
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = res.choices[0]?.message?.content ?? "";
    const json = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(json) as { candidate?: { type?: unknown; content?: unknown } | null };
    const candidate = parsed.candidate;
    if (!candidate || !isMemoryType(candidate.type) || typeof candidate.content !== "string") return;
    const content = candidate.content.trim();
    if (!content || known.includes(content)) return;

    const [created] = await db.insert(memoryCandidatesTable).values({
      chatId,
      type: candidate.type,
      content,
    }).returning();
    if (!created) return;

    await bot.sendMessage(
      chatId,
      `記憶候補\n種類：${MEMORY_LABELS[candidate.type]}\n内容：${content}`,
      { reply_markup: { inline_keyboard: [[
        { text: "保存", callback_data: `memory:save:${created.id}` },
        { text: "見送り", callback_data: `memory:dismiss:${created.id}` },
      ]] } },
    );
    logger.info({ chatId, candidateId: created.id }, "Memory candidate created");
  } catch (err) {
    logger.warn(
      { errorType: err instanceof Error ? err.name : "UnknownError", message: err instanceof Error ? err.message : String(err) },
      "OpenAI memory candidate extraction failed (non-critical)",
    );
  }
}
