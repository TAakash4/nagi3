import OpenAI from "openai";

const llmApiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
const llmModel = process.env.LLM_MODEL?.trim() || "gpt-4o-mini";
// 会話用モデル（gpt-4o-mini など）はウェブ検索ツールに対応していないことがあるので、
// 検索だけ別モデルに分ける。
const searchLlmModel = process.env.SEARCH_MODEL?.trim() || "gpt-4o";

if (!llmApiKey) throw new Error("LLM_API_KEY or OPENAI_API_KEY is not set");

export const openaiClient = new OpenAI({ apiKey: llmApiKey });
export const textModel = llmModel;
export const searchModel = searchLlmModel;
