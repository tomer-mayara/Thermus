import type { ExecFileException } from 'node:child_process';
import { WebsiteFetchFailure, processDiagnostic, resultDiagnostic } from './fetch-diagnostic.ts';
import { WebsiteFetchHttpError, type WebsiteFetchResult } from './website-fetcher.ts';

const LIGHTPANDA_HTTP_ERROR_EXIT_CODE = 22;

function readFetchOutput(stdout: string, cause: ExecFileException | null): Record<string, unknown> {
  try {
    const output: unknown = JSON.parse(stdout);
    if (typeof output !== 'object' || output === null || Array.isArray(output)) throw new Error('Expected a fetch result object');
    return output as Record<string, unknown>;
  } catch {
    const diagnostic = { category: cause === null ? 'validation' : 'unknown', phase: cause === null ? 'renderer_result' : 'renderer_process', ...processDiagnostic(cause), metadata: stdout.length === 0 ? 'absent' : 'invalid' } as const;
    if (cause?.code === LIGHTPANDA_HTTP_ERROR_EXIT_CODE && !cause.killed && cause.signal == null) throw new WebsiteFetchHttpError(undefined, { cause }, { ...diagnostic, category: 'http' });
    throw new WebsiteFetchFailure(cause?.message ?? 'lightpanda returned invalid fetch metadata', diagnostic, { cause: cause ?? undefined });
  }
}

function assertSuccessfulHttpStatus(result: Record<string, unknown>, cause: ExecFileException | null): void {
  const metadata = resultDiagnostic(result);
  const diagnostic = { phase: 'renderer_result', ...metadata, ...processDiagnostic(cause) } as const;
  if (cause !== null && (cause.killed || cause.signal != null || typeof cause.code !== 'number')) {
    throw new WebsiteFetchFailure('Renderer process failed', { ...diagnostic, category: 'unknown', phase: 'renderer_process' }, { cause });
  }
  if ((metadata.httpStatus ?? 0) >= 400 || cause?.code === LIGHTPANDA_HTTP_ERROR_EXIT_CODE) {
    throw new WebsiteFetchHttpError(metadata.httpStatus, { cause: cause ?? undefined }, { ...diagnostic, category: 'http' });
  }
  if (cause !== null) {
    throw new WebsiteFetchFailure('Renderer process failed', { ...diagnostic, category: metadata.rendererErrorCode !== undefined && metadata.rendererErrorCode !== 'unknown' ? 'renderer' : 'unknown' }, { cause });
  }
  if (metadata.httpStatus === undefined || metadata.httpStatus < 200) {
    throw new WebsiteFetchFailure('lightpanda did not return successful HTML', { ...diagnostic, category: 'validation', reason: 'invalid_http_status' });
  }
}

export function parseRendererResult(requestedUrl: string, stdout: string, cause: ExecFileException | null): WebsiteFetchResult {
  const result = readFetchOutput(stdout, cause);
  assertSuccessfulHttpStatus(result, cause);
  if (
    typeof result.url !== 'string'
    || typeof result.content !== 'string'
    || result.error !== null
  ) {
    throw new WebsiteFetchFailure('lightpanda did not return successful HTML', { category: 'validation', phase: 'renderer_result', reason: 'invalid_result', ...resultDiagnostic(result) });
  }
  let finalUrl: URL;
  try { finalUrl = new URL(result.url); } catch (cause) {
    throw new WebsiteFetchFailure('Invalid URL', { category: 'validation', phase: 'renderer_result', reason: 'invalid_final_url', ...resultDiagnostic(result) }, { cause });
  }
  if (finalUrl.protocol !== 'http:' && finalUrl.protocol !== 'https:') {
    throw new WebsiteFetchFailure('lightpanda final URL must use http or https', { category: 'validation', phase: 'renderer_result', reason: 'invalid_final_url', ...resultDiagnostic(result) });
  }
  return { requestedUrl, finalUrl: finalUrl.href, html: result.content };
}
