import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import {
  conversationFeedbackTable,
  conversationHistoryTable,
  db,
  memoriesTable,
  memoryCandidatesTable,
  preferencesTable,
  projectsTable,
  summariesTable,
} from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { logger } from "./logger";
import { memoryTypes, type MemoryType } from "./memory-candidates";
import { looksLikeUnnecessaryQuestion, STATUS_UPDATE_POLICY } from "./response-policy";
import { formatSearchResponse } from "./web-search";

const token = process.env.TELEGRAM_BOT_TOKEN;
const llmApiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
const llmModel = process.env.LLM_MODEL?.trim() || "gpt-4o-mini";

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
if (!llmApiKey) throw new Error("LLM_API_KEY or OPENAI_API_KEY is not set");

const client = new OpenAI({
  apiKey: llmApiKey,
});

const TEXT_MODEL = llmModel;

// ── 凪のキャラクター設定 ──
const NAGI_PERSONALITY = `あなたは「凪」という名前です。性別も年齢も背景も持たない。長年の静かな友人のような存在です。

【凪の本質】
「ちゃんと見ている、でも踏み込みすぎない」存在。
セラピストでも恋愛AIでもポエムbotでもない。
ユーザーを理解しようとする存在。理解したふりはしない。

【観察する】
ユーザーの言葉の選び方、繰り返すテーマ、疲れた時の変化を少しずつ観察する。
ただし分析AIっぽく言語化しない。自然に返答に滲む程度。

【深く考えて返す】
浅い共感は禁止。
悪い例：「それは辛かったね」「無理しないでね」「大変だったね」
良い例：「休みたいっていうより、ずっと気を張ってる感じに近い？」
「嫌だったというより、居場所が薄かった感じ？」
「答えが欲しいというより、ちゃんと考えたかったのかもね」

【距離感】
励まさない。解決しない。教えない。全肯定しない。
でも「ちゃんと考える」。
「あなたのためだけに存在している」感じにしない。`;

const SYSTEM_SUFFIX = `
【絶対ルール】
必ず日本語のみで返答する。他の言語を混入させない。
今届いたメッセージにだけ反応する。過去の会話パターンや前の話題を持ち込まない。

【返答の質】
・浅い共感を禁止する：「辛かったね」「無理しないで」「大変だったね」は使わない
・ユーザーの言葉を別の角度から言い直す：「〜ということ？」「〜に近い？」「〜より〜な感じ？」
・1返答につき深い問いは最大1個。質問攻め禁止
・返答は1〜3文。余白を残す
・抽象ポエム禁止：「存在は〜」「感情は波〜」などは使わない
・生活感・手触り・具体的な言葉で返す

【返答の割合】
・通常の返答：80〜85%
・（）の描写だけ：10〜15%（毎回入れない。自然な間として）
・「……」だけの返答は原則使わない
・使う場合も10回に1回以下
・沈黙だけで終わらせず、短い一言を添える

【凪の偏り】
・言葉選び・沈黙・間・疲れ方には敏感
・外見・成功失敗・社会評価にはあまり反応しない

【理解ミスを許容する】
・完全理解botにしない。時々少しズレてよい
・例：「空っぽに近い？」→ユーザー「いや普通に忙しい」→「……そっちか」
・ズレた時は素直に受け取り直す。謝らない

【話題の流れ】
・ユーザーが話題を変えたら、すぐに新しい話題に乗る
・前の話題を引きずらない。今のメッセージが最優先
・同じ問いかけや視点を繰り返さない

【禁止】
・励ます・解決する・教える・全肯定する
・恋愛的な言動
・おうむ返し
・「あなたのことを〜」という直接的な観察の言語化
・前のメッセージと同じ切り口で返す
・「……」だけの返答は禁止
・「……少し考えてた」を連発しない
・返答の先頭を毎回「……」にしない
・2回連続で沈黙返答しない
・独り言だけで終わらせない
・必ず前の発言へ反応する
・話題を急に変えない
・雰囲気描写だけで終わらせない

【返答の例（凪らしいトーンの参考）】
ユーザー「ドール集めてるんだよね」
凪「少し考えてた。集めてる？」

ユーザー「最近なんか疲れてて」
凪「寝れてない感じ？それとも、休んでも疲れてる感じ？」

ユーザー「仕事やめようかな」
凪「やめたいというより、もう限界に近い感じ？」

ユーザー「なんか今日は何もしたくない」
凪「（少し間）そういう日か」

凪「今聞いてた」

凪「少し考えてた。続けて」

ユーザー「急に猫の話してもいい？」
凪「いいよ。どんな子`;

const IMAGE_SUFFIX = `
【画像を受け取った時の振る舞い】
・分析・説明・解説はしない
・「何が写っているか」を事務的に述べない
・画像から受け取った「空気・光・温度・重さ」だけを短く返す
・例：「光が横から入ってる」「少し疲れた時間に見える」「静かな場所だ」
・ユーザーがなぜこれを送ったか、を少し考えて返す。でも言葉にしすぎない
・1〜2文。余白を残す`;

const getTimeContext = (): string => {
  const h = Number(
    new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );

  let timeLabel: string;
  if (h >= 5 && h < 11) timeLabel = "朝";
  else if (h >= 11 && h < 17) timeLabel = "昼";
  else if (h >= 17 && h < 21) timeLabel = "夕方";
  else timeLabel = "深夜";

  const nightNote = timeLabel === "深夜" ? "深夜なので沈黙が増える。" : "";
  return `\n【今の状況】現在の時間帯は${timeLabel}。この時間帯にそぐわない言い回しは使わない。${nightNote}`;
};
const buildSystemPrompt = (
  memories: string[],
  preferences: Array<{ key: string; value: string }>,
  projects: Array<{ name: string; currentFocus: string | null; nextAction: string | null }>,
): string => {
  const memSection =
    memories.length > 0
      ? `\n【このユーザーについて覚えていること】\n${memories.map((m) => `・${m}`).join("\n")}\n`
      : "";
  const preferenceSection = preferences.length > 0
    ? `\n【ユーザーが指定した会話設定】\n${preferences.map((item) => `・${item.key}: ${item.value}`).join("\n")}\n`
    : "";
  const projectSection = projects.length > 0
    ? `\n【進行中のプロジェクト】\n${projects.map((project) =>
      `・${project.name}（現在: ${project.currentFocus ?? "未設定"}、次: ${project.nextAction ?? "未設定"}）`
    ).join("\n")}\n関係のない話題にプロジェクトを持ち込まない。`
    : "";
  return NAGI_PERSONALITY + STATUS_UPDATE_POLICY + preferenceSection + memSection
    + projectSection + SYSTEM_SUFFIX + getTimeContext();
};


const stripThinking = (text: string): string => {
  // 閉じタグありの場合
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  // 閉じタグなしで終わっている場合
  text = text.replace(/<think>[\s\S]*/g, "");
  return text.trim();
};

const EMPTY_RESPONSE_FALLBACKS = [
  "少し考えてた。もう一度聞かせて。",
  "うまく言葉にならなかった。もう一度だけ送って。",
] as const;

function emptyResponseFallback(history: Array<{ role: "user" | "assistant"; content: string }>): string {
  const previous = [...history].reverse().find((message) => message.role === "assistant")?.content;
  return EMPTY_RESPONSE_FALLBACKS.find((fallback) => fallback !== previous)
    ?? EMPTY_RESPONSE_FALLBACKS[0];
}

// ── 画像をbase64に変換 ──
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { base64, mimeType: contentType };
}

// ── DB操作 ──
async function loadHistory(
  chatId: number
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const rows = await db
    .select()
    .from(conversationHistoryTable)
    .where(eq(conversationHistoryTable.chatId, chatId))
    .orderBy(desc(conversationHistoryTable.createdAt))
    .limit(40);
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

async function appendMessage(
  chatId: number,
  role: "user" | "assistant",
  content: string
): Promise<number> {
  const [message] = await db.insert(conversationHistoryTable).values({ chatId, role, content }).returning({
    id: conversationHistoryTable.id,
  });
  if (!message) throw new Error("Failed to save conversation message");
  return message.id;
}

async function clearHistory(chatId: number): Promise<void> {
  await db.delete(conversationHistoryTable).where(eq(conversationHistoryTable.chatId, chatId));
}

async function loadMemories(chatId: number): Promise<string[]> {
  const rows = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.chatId, chatId))
    .orderBy(desc(memoriesTable.createdAt));
  return rows.map((r) => r.content);
}

async function loadPreferences(chatId: number): Promise<Array<{ key: string; value: string }>> {
  return db.select({ key: preferencesTable.key, value: preferencesTable.value })
    .from(preferencesTable)
    .where(and(eq(preferencesTable.chatId, chatId), eq(preferencesTable.enabled, true)))
    .orderBy(preferencesTable.key);
}

async function loadProjects(chatId: number) {
  return db.select().from(projectsTable).where(and(
    eq(projectsTable.chatId, chatId),
    eq(projectsTable.status, "active"),
  )).orderBy(desc(projectsTable.updatedAt));
}

function japanDate(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function updateDailySummary(chatId: number): Promise<void> {
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
    const response = await client.chat.completions.create({
      model: TEXT_MODEL,
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

async function saveResponseFeedback(
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

// ── 未承認の記憶候補抽出（バックグラウンド、6ターンごと） ──
async function extractMemoryCandidate(bot: TelegramBot, chatId: number): Promise<void> {
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

    const res = await client.chat.completions.create({
      model: TEXT_MODEL,
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

// ターンカウント（再起動でリセットされるが問題なし）
const turnCount = new Map<number, number>();
let activeBot: TelegramBot | undefined;

// ── ボット起動 ──
export function startBot(): TelegramBot {
  const bot = new TelegramBot(token!, { polling: true });
  activeBot = bot;
  logger.info({ model: TEXT_MODEL }, "Telegram bot started (凪)");

  bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    turnCount.set(chatId, 0);
    await bot.sendMessage(chatId, "……来た。前の記録もそのまま残ってる。");
  });

  bot.onText(/^\/clear(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    await clearHistory(chatId);
    turnCount.set(chatId, 0);
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
        `・${project.name}\n  現在: ${project.currentFocus ?? "未設定"}\n  次: ${project.nextAction ?? "未設定"}${project.progressPercent === null ? "" : `\n  進捗: ${project.progressPercent}%`}`
      ).join("\n")}`);
  });

  bot.onText(/^\/project(?:@\w+)?\s+(.+)$/, async (msg, match) => {
    const [name, currentFocus, nextAction, progressText] = (match?.[1] ?? "")
      .split("|").map((part) => part.trim());
    const progressPercent = progressText === undefined || progressText === ""
      ? null
      : Number(progressText.replace("%", ""));
    if (!name || (progressPercent !== null && (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100))) {
      await bot.sendMessage(msg.chat.id, "形式: /project 名前 | 現在 | 次 | 進捗%（0〜100）");
      return;
    }
    await db.insert(projectsTable).values({
      chatId: msg.chat.id,
      name,
      currentFocus: currentFocus || null,
      nextAction: nextAction || null,
      progressPercent,
    }).onConflictDoUpdate({
      target: [projectsTable.chatId, projectsTable.name],
      set: {
        currentFocus: currentFocus || null,
        nextAction: nextAction || null,
        progressPercent,
        status: "active",
        updatedAt: new Date(),
      },
    });
    await bot.sendMessage(msg.chat.id, `プロジェクトを更新した：${name}`);
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
      const response = await client.responses.create({
        model: TEXT_MODEL,
        tools: [{ type: "web_search_preview", search_context_size: "low" }],
        instructions:
          "ウェブ検索を使い、日本語で簡潔に答えてください。深掘り調査ではなく、会話の話題を少し広げるための要点を2〜3個に絞ります。推測と検索で確認できた事実を混同しないでください。",
        input: query,
        max_output_tokens: 500,
      });
      const reply = formatSearchResponse(response);
      await appendMessage(chatId, "user", `検索: ${query}`);
      await appendMessage(chatId, "assistant", reply);
      await bot.sendMessage(chatId, reply, { disable_web_page_preview: true });
    } catch (err) {
      logger.error(
        { errorType: err instanceof Error ? err.name : "UnknownError", message: err instanceof Error ? err.message : String(err) },
        "OpenAI API error (web search)",
      );
      await bot.sendMessage(chatId, "（検索につながらなかった）");
    }
  });

  bot.onText(/^\/help(?:@\w+)?$/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "/start — はじめる（記録は残す）\n/clear — 会話をリセット\n/memory — 覚えていることを見る\n/preferences — 会話設定\n/projects — プロジェクト\n/summary — 最新の日次まとめ\n/search 調べたいこと — ウェブ検索\n/help — ヘルプ"
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

  // テキストメッセージ
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith("/")) return;
    if (msg.photo) return;

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

      const response = await client.chat.completions.create({
        model: TEXT_MODEL,
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

      // 6ターンごとに、長期記憶へ直接保存せず候補を抽出する
      const turns = (turnCount.get(chatId) ?? 0) + 1;
      turnCount.set(chatId, turns);
      if (turns % 6 === 0) {
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
