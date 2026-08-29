import TelegramBot from "node-telegram-bot-api";
import { and, desc, eq } from "drizzle-orm";

import {
  appendMessage,
  clearHistory,
  loadHistory,
  loadMemories,
  loadPreferences,
  loadProjects,
} from "./bot/conversation-store";
import { saveResponseFeedback, updateDailySummary } from "./bot/feedback";
import { extractMemoryCandidate } from "./bot/memory-extraction";
import { openaiClient, searchModel, textModel } from "./bot/openai-client";
import { buildSystemPrompt, emptyResponseFallback, stripThinking } from "./bot/prompts";
import {
  db,
  memoriesTable,
  memoryCandidatesTable,
  preferencesTable,
  summariesTable,
} from "./db";
import { logger } from "./logger";
import {
  changeProjectStatus,
  parseProjectStatusChange,
  parseProjectUpdate,
  projectStatusLabel,
  projectStatuses,
  upsertProject,
} from "./project-commands";
import { incrementTurnCount, resetTurnCount, shouldRunPeriodicTasks } from "./turn-count";
import {
  buildSearchRequest,
  describeSearchError,
  formatSearchResponse,
  isUnsupportedToolError,
  webSearchTools,
} from "./web-search";

async function searchWeb(query: string): Promise<string> {
  let lastError: unknown;
  for (const tool of webSearchTools) {
    try {
      const response = await openaiClient.responses.create(
        buildSearchRequest(query, searchModel, tool),
      );
      return formatSearchResponse(response);
    } catch (err) {
      lastError = err;
      if (!isUnsupportedToolError(err)) throw err;
      logger.warn(
        { tool: tool.type, model: searchModel, message: describeSearchError(err) },
        "Web search tool unsupported for this model, trying the next tool type",
      );
    }
  }
  throw lastError;
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

export function startBot(): TelegramBot {
  const bot = new TelegramBot(token!, { polling: true });
  logger.info({ model: textModel }, "Telegram bot started (凪)");

  bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    await resetTurnCount(chatId);
    await bot.sendMessage(chatId, "……来た。前の記録もそのまま残ってる。");
  });

  bot.onText(/^\/clear(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    await clearHistory(chatId);
    await resetTurnCount(chatId);
    await bot.sendMessage(chatId, "（静かになった）");
  });

  bot.onText(/^\/memory(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const mems = await loadMemories(chatId);
    if (mems.length === 0) {
      await bot.sendMessage(chatId, "（まだ何も覚えていない）");
    } else {
      await bot.sendMessage(chatId, `覚えていること：\n${mems.map((m) => `・${m}`).join("\n")}`);
    }
  });

  bot.onText(/^\/preferences(?:@\w+)?$/, async (msg) => {
    const items = await loadPreferences(msg.chat.id);
    await bot.sendMessage(msg.chat.id, items.length === 0
      ? "会話設定はまだない。\n追加: /preference 項目 | 内容"
      : `会話設定：\n${items.map((item) => `・${item.key}: ${item.value}`).join("\n")}`);
  });

  bot.onText(/^\/preference(?:@\w+)?\s+(.+)$/, async (msg, match) => {
    const [key, ...valueParts] = (match?.[1] ?? "").split("|").map((part) => part.trim());
    const value = valueParts.join(" | ");
    if (!key || !value) {
      await bot.sendMessage(msg.chat.id, "形式: /preference 質問方針 | 質問は必要最小限");
      return;
    }
    await db.insert(preferencesTable).values({ chatId: msg.chat.id, key, value, source: "explicit" })
      .onConflictDoUpdate({
        target: [preferencesTable.chatId, preferencesTable.key],
        set: { value, source: "explicit", enabled: true, updatedAt: new Date() },
      });
    await bot.sendMessage(msg.chat.id, `会話設定に追加した：${key}`);
  });

  bot.onText(/^\/projects(?:@\w+)?$/, async (msg) => {
    const projects = await loadProjects(msg.chat.id);
    await bot.sendMessage(msg.chat.id, projects.length === 0
      ? "進行中のプロジェクトはまだない。\n追加: /project 名前 | 現在 | 次 | 進捗%"
      : `進行中：\n${projects.map((project) =>
        `・${project.name}\n  現在: ${project.currentFocus ?? "未設定"}\n  次: ${project.nextAction ?? "未設定"}${project.progressPercent === null ? "" : `\n  進捗: ${project.progressPercent}%`}`,
      ).join("\n")}`);
  });

  bot.onText(/^\/project(?:@\w+)?\s+(.+)$/, async (msg, match) => {
    const parsed = parseProjectUpdate(match?.[1] ?? "");
    if (!parsed) {
      await bot.sendMessage(msg.chat.id, "形式: /project 名前 | 現在 | 次 | 進捗%（0〜100）");
      return;
    }
    await upsertProject(msg.chat.id, parsed);
    await bot.sendMessage(msg.chat.id, `プロジェクトを更新した：${parsed.name}`);
  });

  bot.onText(/^\/projectstatus(?:@\w+)?\s+(.+)$/, async (msg, match) => {
    const parsed = parseProjectStatusChange(match?.[1] ?? "");
    if (!parsed) {
      await bot.sendMessage(
        msg.chat.id,
        `形式: /projectstatus 名前 | 状態\n状態: ${projectStatuses.join(" / ")}`,
      );
      return;
    }
    const updated = await changeProjectStatus(msg.chat.id, parsed.name, parsed.status);
    if (!updated) {
      await bot.sendMessage(msg.chat.id, `プロジェクトが見つからない：${parsed.name}`);
      return;
    }
    await bot.sendMessage(
      msg.chat.id,
      `${parsed.name} を ${projectStatusLabel(parsed.status)} にした。`,
    );
  });

  bot.onText(/^\/summary(?:@\w+)?$/, async (msg) => {
    const [summary] = await db.select().from(summariesTable).where(and(
      eq(summariesTable.chatId, msg.chat.id),
      eq(summariesTable.periodType, "daily"),
    )).orderBy(desc(summariesTable.periodStart)).limit(1);
    await bot.sendMessage(msg.chat.id, summary
      ? `${summary.periodStart}のまとめ\n${summary.content}`
      : "日次まとめはまだない。会話が6ターン進むと作る。");
  });

  bot.onText(/^\/search(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match?.[1]?.trim();
    if (!query) {
      await bot.sendMessage(chatId, "検索する言葉を続けて送って。例: /search 最近の月面探査");
      return;
    }

    try {
      await bot.sendChatAction(chatId, "typing");
      const reply = await searchWeb(query);
      await appendMessage(chatId, "user", `検索: ${query}`);
      await appendMessage(chatId, "assistant", reply);
      await bot.sendMessage(chatId, reply, { disable_web_page_preview: true });
    } catch (err) {
      const reason = describeSearchError(err);
      logger.error(
        { errorType: err instanceof Error ? err.name : "UnknownError", model: searchModel, message: reason },
        "OpenAI API error (web search)",
      );
      await bot.sendMessage(chatId, `（検索につながらなかった：${reason}）`);
    }
  });

  bot.onText(/^\/help(?:@\w+)?$/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "/start — はじめる（記録は残す）\n/clear — 会話をリセット\n/memory — 覚えていることを見る\n/preferences — 会話設定\n/projects — プロジェクト\n/project — プロジェクト更新\n/projectstatus — プロジェクトの状態変更\n/summary — 最新の日次まとめ\n/search 調べたいこと — ウェブ検索\n/help — ヘルプ",
    );
  });

  bot.on("callback_query", async (query) => {
    const match = query.data?.match(/^memory:(save|dismiss):(\d+)$/);
    if (!match || !query.message) return;
    const action = match[1];
    const candidateId = Number(match[2]);
    const chatId = query.message.chat.id;

    try {
      const [candidate] = await db.select().from(memoryCandidatesTable).where(and(
        eq(memoryCandidatesTable.id, candidateId),
        eq(memoryCandidatesTable.chatId, chatId),
        eq(memoryCandidatesTable.status, "pending"),
      )).limit(1);
      if (!candidate) {
        await bot.answerCallbackQuery(query.id, { text: "この候補は処理済みです" });
        return;
      }

      if (action === "save") {
        await db.transaction(async (tx) => {
          await tx.insert(memoriesTable).values({
            chatId,
            type: candidate.type,
            content: candidate.content,
          });
          await tx.update(memoryCandidatesTable).set({ status: "saved", resolvedAt: new Date() })
            .where(eq(memoryCandidatesTable.id, candidateId));
        });
      } else {
        await db.update(memoryCandidatesTable).set({ status: "dismissed", resolvedAt: new Date() })
          .where(eq(memoryCandidatesTable.id, candidateId));
      }

      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
      await bot.answerCallbackQuery(query.id, { text: action === "save" ? "保存しました" : "見送りました" });
    } catch (err) {
      logger.error({
        errorType: err instanceof Error ? err.name : "UnknownError",
        chatId,
        candidateId,
      }, "Memory candidate resolution failed");
      await bot.answerCallbackQuery(query.id, { text: "処理できませんでした" });
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith("/")) return;

    try {
      await bot.sendChatAction(chatId, "typing");
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 900));

      await appendMessage(chatId, "user", text);
      const [history, memories, preferences, projects] = await Promise.all([
        loadHistory(chatId),
        loadMemories(chatId),
        loadPreferences(chatId),
        loadProjects(chatId),
      ]);
      const fullRecent = history.slice(-5);

      const response = await openaiClient.chat.completions.create({
        model: textModel,
        max_completion_tokens: 300,
        messages: [
          { role: "system", content: buildSystemPrompt(memories, preferences, projects) },
          ...fullRecent,
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "";
      const cleaned = stripThinking(raw).trim();
      const reply =
        cleaned.length === 0 ||
        cleaned === "……" ||
        cleaned === "..." ||
        cleaned === "…"
          ? emptyResponseFallback(history)
          : cleaned;
      const assistantMessageId = await appendMessage(chatId, "assistant", reply);
      await bot.sendMessage(chatId, reply);
      void saveResponseFeedback(chatId, assistantMessageId, text, reply).catch((err) => {
        logger.warn({ message: err instanceof Error ? err.message : String(err) }, "Response feedback save failed (non-critical)");
      });

      const turns = await incrementTurnCount(chatId);
      if (shouldRunPeriodicTasks(turns)) {
        setTimeout(() => void extractMemoryCandidate(bot, chatId), 2000);
        setTimeout(() => void updateDailySummary(chatId), 2500);
      }
    } catch (err) {
      logger.error(
        { errorType: err instanceof Error ? err.name : "UnknownError", message: err instanceof Error ? err.message : String(err) },
        "OpenAI API error (text)",
      );
      await bot.sendMessage(chatId, "（通信エラー）");
    }
  });

  bot.on("polling_error", (err) => {
    logger.error(
      { errorType: err.name, code: (err as { code?: string }).code, message: err.message },
      "Telegram polling error",
    );
  });

  return bot;
}
