import type { ExecFileException } from 'node:child_process';
import { WebsiteFetchFailure, processDiagnostic, resultDiagnostic, type FetchDiagnostic } from './fetch-diagnostic.ts';
import { WebsiteFetchHttpError, type WebsiteFetchResult } from './website-fetcher.ts';

const LIGHTPANDA_HTTP_ERROR_EXIT_CODE = 22;

function readFetchOutput(stdout: string, cause: ExecFileException | null): Record<string, unknown> {
  const output = jsonObjectOf(stdout);
  if (output === undefined) throw invalidOutputFailure(stdout, cause);
  return output;
}

function jsonObjectOf(text: string): Record<string, unknown> | undefined {
  try {
    const output: unknown = JSON.parse(text);
    return typeof output === 'object' && output !== null && !Array.isArray(output) ? output as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function invalidOutputFailure(stdout: string, cause: ExecFileException | null): WebsiteFetchFailure {
  const source = cause === null ? { category: 'validation', phase: 'renderer_result' } as const : { category: 'unknown', phase: 'renderer_process' } as const;
  const diagnostic = { ...source, ...processDiagnostic(cause), metadata: stdout.length === 0 ? 'absent' : 'invalid' } as const;
  if (isHttpErrorExit(cause)) return new WebsiteFetchHttpError(undefined, { cause }, { ...diagnostic, category: 'http' });
  return new WebsiteFetchFailure(cause?.message ?? 'lightpanda returned invalid fetch metadata', diagnostic, { cause: cause ?? undefined });
}

function isHttpErrorExit(cause: ExecFileException | null): boolean {
  return cause?.code === LIGHTPANDA_HTTP_ERROR_EXIT_CODE && !cause.killed && cause.signal == null;
}

function assertSuccessfulHttpStatus(result: Record<string, unknown>, cause: ExecFileException | null): void {
  const metadata = resultDiagnostic(result);
  const diagnostic = { phase: 'renderer_result', ...metadata, ...processDiagnostic(cause) } as const;
  if (cause !== null && exitedAbnormally(cause)) {
    throw new WebsiteFetchFailure('Renderer process failed', { ...diagnostic, category: 'unknown', phase: 'renderer_process' }, { cause });
  }
  if (isHttpFailure(metadata, cause)) {
    throw new WebsiteFetchHttpError(metadata.httpStatus, { cause: cause ?? undefined }, { ...diagnostic, category: 'http' });
  }
  if (cause !== null) {
    throw new WebsiteFetchFailure('Renderer process failed', { ...diagnostic, category: rendererFailureCategory(metadata) }, { cause });
  }
  if (metadata.httpStatus === undefined || metadata.httpStatus < 200) {
    throw new WebsiteFetchFailure('lightpanda did not return successful HTML', { ...diagnostic, category: 'validation', reason: 'invalid_http_status' });
  }
}

function exitedAbnormally(cause: ExecFileException): boolean {
  return cause.killed || cause.signal != null || typeof cause.code !== 'number';
}

function isHttpFailure(metadata: Partial<FetchDiagnostic>, cause: ExecFileException | null): boolean {
  return (metadata.httpStatus ?? 0) >= 400 || cause?.code === LIGHTPANDA_HTTP_ERROR_EXIT_CODE;
}

function rendererFailureCategory(metadata: Partial<FetchDiagnostic>): FetchDiagnostic['category'] {
  return metadata.rendererErrorCode !== undefined && metadata.rendererErrorCode !== 'unknown' ? 'renderer' : 'unknown';
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
