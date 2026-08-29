# 凪 Telegram Bot

TypeScript、Express、PostgreSQL（Drizzle）、OpenAI公式APIで動く Telegram Bot です。会話から抽出した長期記憶は直接保存せず、Telegram 上で承認された候補だけを保存します。

## セットアップ

Node.js 20 以降と pnpm、PostgreSQL が必要です。

```bash
pnpm install
export PORT=3000
export DATABASE_URL='postgresql://...'
export TELEGRAM_BOT_TOKEN='...'
export LLM_API_KEY='...'
export LLM_MODEL='gpt-4o-mini'
export SEARCH_MODEL='gpt-4o'
pnpm run typecheck
pnpm start
```

Railwayの既存設定に合わせて、APIキーは `LLM_API_KEY`、モデルは `LLM_MODEL` から読み込みます。`LLM_API_KEY` が未設定の場合は `OPENAI_API_KEY` も利用できます。`LLM_MODEL` が空または未設定の場合は `gpt-4o-mini` を使用します。通常会話と6ターンごとの記憶候補抽出には同じモデルを利用します。

`/search` だけは `SEARCH_MODEL`（未設定なら `gpt-4o`）を使います。`gpt-4o-mini` のような軽量モデルは Responses API のウェブ検索ツールに対応しておらず、`Hosted tool 'web_search_preview' is not supported with ...` で失敗するためです。検索ツールは `web_search_preview` を先に試し、モデルが未対応ならば `web_search` に切り替えます。`tool_choice` は `required` を指定しており、モデルが検索を省いて手持ちの知識だけで答えることはありません。どちらも通らない場合は Telegram の返信に API のエラー文をそのまま添えます。

トークンや API キーをソースへ書き込まず、Replit Secrets または移行先のシークレット管理機能から環境変数として渡してください。時刻に依存する応答は実行環境のタイムゾーンにかかわらず `Asia/Tokyo` を使います。

## 記憶候補

6ターンごとに直近の会話から候補を最大1件抽出します。候補の種類は `value`、`principle`、`goal`、`learning`、`profile` です。

- **保存**: 候補を `memories` に追加します。
- **見送り**: 候補を長期記憶へ追加しません。
- 未操作の候補は `pending` のままで、応答プロンプトの長期記憶には含まれません。

マイグレーションは起動時に自動実行されます。適用済みの変更は `schema_migrations` テーブルで管理され、未適用のものだけ実行されます。既存の `memories` を削除せず、`type` 列と `memory_candidates` テーブルを追加します。手動で確認するときは `pnpm run db:migrate` を実行できます。

## ライフOS機能

近況報告には、まず受け止めまたは短い要約を返します。回答に必要でない質問や、会話を続けるためだけの質問は行いません。各応答はバックグラウンドで最低限の品質評価を保存します。

- `/preferences` — 会話設定の一覧
- `/preference 項目 | 内容` — 明示的な会話設定を追加・更新
- `/projects` — 進行中のプロジェクト一覧
- `/project 名前 | 現在 | 次 | 進捗%` — プロジェクトを追加・更新
- `/projectstatus 名前 | 状態` — プロジェクトの状態を変更（`active` / `paused` / `completed` / `archived`）
- `/summary` — 最新の日次まとめ（6ターンごとに当日の会話から更新）
- `/search 調べたいこと` — ウェブを軽く検索し、話題を広げる要点と参照ページを表示

`/start` は履歴や記憶を削除しません。会話履歴だけを消す場合は `/clear` を使います。

## Railway

Railwayのサービスには `DATABASE_URL`、`TELEGRAM_BOT_TOKEN`、`LLM_API_KEY`、`LLM_MODEL=gpt-4o-mini`、`SEARCH_MODEL=gpt-4o` を設定してください。`PORT` はRailwayが自動設定します。OpenAI公式APIへ接続するため、独自のベースURLは不要です。`railway.json` に起動コマンド、`/health` のヘルスチェック、失敗時の再起動方針を定義しています。

Telegramのlong pollingでは同じBot Tokenを使うプロセスを複数同時に起動できません。レプリカ数は **1** にしてください。
