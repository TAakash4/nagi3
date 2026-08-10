import assert from "node:assert/strict";
import test from "node:test";

import { emptyResponseFallback, stripThinking } from "./prompts";

test("thinking ブロックを除去する", () => {
  assert.equal(
    stripThinking("返答\n<think>考え中</think>"),
    "返答",
  );
});

test("空応答のフォールバックは直前と異なる文言を選ぶ", () => {
  const history = [
    { role: "user" as const, content: "こんにちは" },
    { role: "assistant" as const, content: "少し考えてた。もう一度聞かせて。" },
  ];
  assert.notEqual(emptyResponseFallback(history), history[1]?.content);
});
