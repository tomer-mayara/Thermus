import type { ApplicationLogger } from '../../../src/application.ts';
import { BaseLogger } from '../../../src/logging/base-logger.ts';
import type { FetchOperation } from '../../../src/mcp/get-url-as-markdown.ts';

// The Markdown of the completed line is cut at this many code points.
export const MARKDOWN_LOG_LIMIT = 64 * 1024;

export function observeFetches(operation: FetchOperation, logger: ApplicationLogger, limit = MARKDOWN_LOG_LIMIT): FetchOperation {
  return async (url, context, signal) => {
    logger.info(`work-slice fetch started: ${url}`);
    let markdown: string;
    try {
      markdown = await operation(url, context, signal);
    } catch (error) {
      logger.error(`work-slice fetch failed: ${url}: ${BaseLogger.messageOf(error)}`);
      throw error;
    }
    logger.info(completedLine(url, markdown, limit));
    return markdown;
  };
}

function completedLine(url: string, markdown: string, limit: number): string {
  const { count, kept } = firstCodePoints(markdown, limit);
  const cut = count > limit ? `\n[cut: ${count - limit} more characters]` : '';
  return `work-slice fetch completed: ${url} gave ${count} characters of Markdown:\n${kept}${cut}`;
}

// The string iterator gives code points, so the count is not in UTF-16 units and the cut keeps each surrogate pair.
function firstCodePoints(text: string, limit: number): { count: number; kept: string } {
  let count = 0;
  let end = 0;
  for (const codePoint of text) {
    if (count < limit) end += codePoint.length;
    count += 1;
  }
  return { count, kept: text.slice(0, end) };
}
