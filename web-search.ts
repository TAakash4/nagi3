export type SearchResponse = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string } | null;
  output: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
      annotations?: Array<{
        type: string;
        title?: string;
        url?: string;
      }>;
    }>;
  }>;
};

// web_search_preview は 4o 系、web_search は新しめのモデルでしか通らない。
// モデルによってどちらが使えるかが違うので、順に試す。
export const webSearchTools = [
  { type: "web_search_preview", search_context_size: "low" },
  { type: "web_search", search_context_size: "low" },
] as const;

export const searchInstructions =
  "ウェブ検索を使い、日本語で簡潔に答えてください。深掘り調査ではなく、会話の話題を少し広げるための要点を2〜3個に絞ります。推測と検索で確認できた事実を混同しないでください。";

export const searchMaxOutputTokens = 1200;

// tool_choice の既定は "auto" で、モデルが「検索しなくても答えられる」と判断すると
// 検索せずに手持ちの知識だけで答えてしまう。/search では必ず検索させる。
export function buildSearchRequest(
  query: string,
  model: string,
  tool: (typeof webSearchTools)[number],
) {
  return {
    model,
    tools: [tool],
    tool_choice: "required" as const,
    instructions: searchInstructions,
    input: query,
    max_output_tokens: searchMaxOutputTokens,
  };
}

export function describeSearchError(err: unknown): string {
  const source = err as { error?: { message?: unknown }; message?: unknown } | null;
  const apiMessage = typeof source?.error?.message === "string" ? source.error.message : undefined;
  const message = apiMessage ?? (typeof source?.message === "string" ? source.message : undefined);
  const trimmed = message?.trim();
  if (!trimmed) return "原因不明";
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
}

// モデルがそのツールに対応していない場合のエラーを判別する。
// 例: "Hosted tool 'web_search_preview' is not supported with gpt-4o-mini."
export function isUnsupportedToolError(err: unknown): boolean {
  const message = describeSearchError(err).toLowerCase();
  if (!message.includes("web_search")) return false;
  return (
    message.includes("hosted tool") ||
    message.includes("not supported") ||
    message.includes("unsupported") ||
    message.includes("unknown parameter")
  );
}

export function formatSearchResponse(response: SearchResponse): string {
  const textParts: string[] = [];
  const sources = new Map<string, string>();

  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type !== "output_text") continue;
      if (content.text?.trim()) textParts.push(content.text.trim());
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation" && annotation.url) {
          sources.set(annotation.url, annotation.title?.trim() || annotation.url);
        }
      }
    }
  }

  const answer = textParts.join("\n").trim();
  if (!answer) {
    if (response.incomplete_details?.reason === "max_output_tokens") {
      return "検索の途中で長さの上限に達した。もう少し絞った言葉で試してみて。";
    }
    if (response.error?.message?.trim()) {
      return `（検索が失敗した：${response.error.message.trim()}）`;
    }
    return "うまく見つけられなかった。言葉を少し変えて試してみて。";
  }
  if (sources.size === 0) return answer;

  const sourceList = [...sources.entries()]
    .slice(0, 3)
    .map(([url, title]) => `・${title}\n${url}`)
    .join("\n");
  return `${answer}\n\n参照したページ\n${sourceList}`;
}
