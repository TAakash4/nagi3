import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchRequest,
  describeSearchError,
  formatSearchResponse,
  isUnsupportedToolError,
  parseSearchQuery,
  searchFunctionTool,
  webSearchTools,
} from "./web-search";

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

test("上限で途切れた検索結果には短くするよう案内する", () => {
  assert.equal(
    formatSearchResponse({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [{ type: "web_search_call" }],
    }),
    "検索の途中で長さの上限に達した。もう少し絞った言葉で試してみて。",
  );
});

test("モデルが検索ツールに未対応のエラーを判別する", () => {
  const err = {
    error: { message: "Hosted tool 'web_search_preview' is not supported with gpt-4o-mini." },
  };
  assert.equal(isUnsupportedToolError(err), true);
  assert.equal(
    describeSearchError(err),
    "Hosted tool 'web_search_preview' is not supported with gpt-4o-mini.",
  );
});

test("検索ツールと無関係なエラーは切り替え対象にしない", () => {
  assert.equal(isUnsupportedToolError(new Error("Connection error.")), false);
  assert.equal(describeSearchError(new Error("Connection error.")), "Connection error.");
  assert.equal(describeSearchError(undefined), "原因不明");
});

test("検索ツールは対応モデルが広い順に試す", () => {
  assert.deepEqual(webSearchTools.map((tool) => tool.type), ["web_search_preview", "web_search"]);
});

test("検索リクエストはモデルに必ず検索させる", () => {
  const request = buildSearchRequest("最近の月面探査", "gpt-4o", webSearchTools[0]);

  assert.equal(request.tool_choice, "required");
  assert.equal(request.model, "gpt-4o");
  assert.equal(request.input, "最近の月面探査");
  assert.deepEqual(request.tools, [webSearchTools[0]]);
});

test("通常会話の検索ツールは query だけを受け取る", () => {
  assert.equal(searchFunctionTool.function.name, "search_web");
  assert.deepEqual(searchFunctionTool.function.parameters.required, ["query"]);
});

test("ツール呼び出しの引数から検索クエリを取り出す", () => {
  assert.equal(parseSearchQuery('{"query":"  最近の月面探査 "}'), "最近の月面探査");
});

test("壊れた引数や空のクエリは検索しない", () => {
  assert.equal(parseSearchQuery("{"), null);
  assert.equal(parseSearchQuery('{"query":"   "}'), null);
  assert.equal(parseSearchQuery('{"query":42}'), null);
  assert.equal(parseSearchQuery('"最近の月面探査"'), null);
});
