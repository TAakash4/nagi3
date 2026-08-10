import assert from "node:assert/strict";
import test from "node:test";

import {
  parseProjectStatusChange,
  parseProjectUpdate,
  projectStatusLabel,
} from "./project-parsing";
import { shouldRunPeriodicTasks, TURN_INTERVAL } from "./turn-count-logic";

test("6ターンごとに定期処理を実行する", () => {
  assert.equal(shouldRunPeriodicTasks(5), false);
  assert.equal(shouldRunPeriodicTasks(6), true);
  assert.equal(shouldRunPeriodicTasks(12), true);
  assert.equal(TURN_INTERVAL, 6);
});

test("プロジェクト更新コマンドを解析する", () => {
  assert.deepEqual(parseProjectUpdate("学習 | API設計 | テスト追加 | 40"), {
    name: "学習",
    currentFocus: "API設計",
    nextAction: "テスト追加",
    progressPercent: 40,
  });
});

test("不正な進捗率は拒否する", () => {
  assert.equal(parseProjectUpdate("学習 | API設計 | テスト追加 | 120"), null);
});

test("プロジェクト状態変更コマンドを解析する", () => {
  assert.deepEqual(parseProjectStatusChange("学習 | paused"), {
    name: "学習",
    status: "paused",
  });
});

test("不正な状態は拒否する", () => {
  assert.equal(parseProjectStatusChange("学習 | waiting"), null);
});

test("状態ラベルを返す", () => {
  assert.equal(projectStatusLabel("paused"), "一時停止");
});
