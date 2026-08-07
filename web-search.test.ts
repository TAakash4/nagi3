import assert from "node:assert/strict";
import test from "node:test";

import { formatSearchResponse } from "./web-search";

test("検索結果に重複を除いた参照ページを付ける", () => {
  const result = formatSearchResponse({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: "最近は小さな展示が話題になっている。",
        annotations: [
          { type: "url_citation", title: "展示のお知らせ", url: "https://example.com/show" },
          { type: "url_citation", title: "展示のお知らせ", url: "https://example.com/show" },
        ],
      }],
    }],
  });

  assert.equal(
    result,
    "最近は小さな展示が話題になっている。\n\n参照したページ\n・展示のお知らせ\nhttps://example.com/show",
  );
});

test("本文がない検索結果には短い案内を返す", () => {
  assert.equal(
    formatSearchResponse({ output: [{ type: "web_search_call" }] }),
    "うまく見つけられなかった。言葉を少し変えて試してみて。",
  );
});
