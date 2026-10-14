import { requirePermission, type RequestContext } from '../auth/access-context.ts';
import { assertHtmlInputSize } from '../html-cleaner-pipeline/html-input-limit.ts';
import type { HtmlToMarkdownPipeline } from '../html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import type { WebsiteFetcher } from '../website-fetcher/website-fetcher.ts';
import { isValidFetchUrl } from './fetch-tool-schema.ts';

export function createGetURLAsMarkdown({ fetcher, pipeline }: {
  fetcher: WebsiteFetcher;
  pipeline: Pick<HtmlToMarkdownPipeline, 'process'>;
}) {
  return async (url: string, context: RequestContext, signal: AbortSignal): Promise<string> => {
    throwIfCancelled(signal);
    requirePermission(context, 'product:access');
    if (!isValidFetchUrl(url)) throw new Error('Invalid tool arguments');

    let page;
    try {
      page = await fetcher.fetchURL(url, signal);
    } catch (error) {
      throwIfCancelled(signal, error);
      throw new Error('Page fetch failed');
    }

    throwIfCancelled(signal);
    try {
      assertHtmlInputSize(page.html);
      const result = await pipeline.process(page, signal);
      throwIfCancelled(signal);
      if (typeof result?.markdown !== 'string') throw new Error('Page processing failed');
      return result.markdown;
    } catch (error) {
      throwIfCancelled(signal, error);
      throw new Error('Page processing failed');
    }
  };
}

function throwIfCancelled(signal: AbortSignal, error?: unknown): void {
  if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
    throw new DOMException('Request cancelled', 'AbortError');
  }
}
