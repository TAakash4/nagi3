# 凪 Telegram Bot

TypeScript、Express、PostgreSQL（Drizzle）、Groqで動く Telegram Bot です。会話から抽出した長期記憶は直接保存せず、Telegram 上で承認された候補だけを保存します。

## セットアップ

Node.js 20 以降と pnpm、PostgreSQL が必要です。

```bash
pnpm install
export PORT=3000
export DATABASE_URL='postgresql://...'
export TELEGRAM_BOT_TOKEN='...'
export GROQ_API_KEY='...'
pnpm run typecheck
pnpm start
```

トークンや API キーをソースへ書き込まず、Replit Secrets または移行先のシークレット管理機能から環境変数として渡してください。時刻に依存する応答は実行環境のタイムゾーンにかかわらず `Asia/Tokyo` を使います。

## 記憶候補

6ターンごとに直近の会話から候補を最大1件抽出します。候補の種類は `value`、`principle`、`goal`、`learning`、`profile` です。

- **保存**: 候補を `memories` に追加します。
- **見送り**: 候補を長期記憶へ追加しません。
- 未操作の候補は `pending` のままで、応答プロンプトの長期記憶には含まれません。

マイグレーションは起動時に自動実行されます。既存の `memories` を削除せず、`type` 列と `memory_candidates` テーブルを追加します。手動で確認するときは `pnpm run db:migrate` を実行できます。

## Railway

Railwayのサービスには `DATABASE_URL`、`TELEGRAM_BOT_TOKEN`、`GROQ_API_KEY` を設定してください。`PORT` はRailwayが自動設定します。`railway.json` に起動コマンド、`/health` のヘルスチェック、失敗時の再起動方針を定義しています。

Telegramのlong pollingでは同じBot Tokenを使うプロセスを複数同時に起動できません。レプリカ数は **1** にしてください。
