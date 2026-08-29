import { logger } from "../logger";
import {
  buildSearchRequest,
  describeSearchError,
  formatSearchResponse,
  isUnsupportedToolError,
  webSearchTools,
} from "../web-search";
import { openaiClient, searchModel } from "./openai-client";

export async function searchWeb(query: string): Promise<string> {
  let lastError: unknown;
  for (const tool of webSearchTools) {
    try {
      const response = await openaiClient.responses.create(
        buildSearchRequest(query, searchModel, tool),
      );
      return formatSearchResponse(response);
    } catch (err) {
      lastError = err;
      if (!isUnsupportedToolError(err)) throw err;
      logger.warn(
        { tool: tool.type, model: searchModel, message: describeSearchError(err) },
        "Web search tool unsupported for this model, trying the next tool type",
      );
    }
  }
  throw lastError;
}
