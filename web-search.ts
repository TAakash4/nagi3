export type SearchResponse = {
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
  if (!answer) return "うまく見つけられなかった。言葉を少し変えて試してみて。";
  if (sources.size === 0) return answer;

  const sourceList = [...sources.entries()]
    .slice(0, 3)
    .map(([url, title]) => `・${title}\n${url}`)
    .join("\n");
  return `${answer}\n\n参照したページ\n${sourceList}`;
}
