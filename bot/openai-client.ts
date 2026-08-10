import OpenAI from "openai";

const llmApiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
const llmModel = process.env.LLM_MODEL?.trim() || "gpt-4o-mini";

if (!llmApiKey) throw new Error("LLM_API_KEY or OPENAI_API_KEY is not set");

export const openaiClient = new OpenAI({ apiKey: llmApiKey });
export const textModel = llmModel;
