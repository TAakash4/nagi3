import assert from "node:assert/strict";
import test from "node:test";

import { looksLikeUnnecessaryQuestion } from "./response-policy";

test("近況報告への質問を不要な質問として検出する", () => {
  assert.equal(looksLikeUnnecessaryQuestion("Python勉強してる", "どんなコード？"), true);
});

test("質問への確認質問は不要と断定しない", () => {
  assert.equal(looksLikeUnnecessaryQuestion("このエラーはどう直す？", "エラー全文を見せてもらえる？"), false);
});

test("近況報告への要約は問題にしない", () => {
  assert.equal(looksLikeUnnecessaryQuestion("今日はOllamaを入れた", "今日は環境を一つ整えたんだね。"), false);
});
