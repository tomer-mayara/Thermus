import { execFile, type ExecFileException } from 'node:child_process';
import { assertPublicDestination, LIGHTPANDA_BLOCKED_CIDRS } from './network-policy.ts';
import { WebsiteFetchHttpError, type WebsiteFetcher, type WebsiteFetchResult } from './website-fetcher.ts';

const LIGHTPANDA_DEFAULT_BIN = 'lightpanda';
const LIGHTPANDA_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const LIGHTPANDA_TIMEOUT_MS = 60_000;
const LIGHTPANDA_READINESS_DEADLINE_MS = 5_000;
const LIGHTPANDA_HTTP_ERROR_EXIT_CODE = 22;

function readFetchOutput(stdout: string, cause: ExecFileException | null): Record<string, unknown> {
  try {
    const output: unknown = JSON.parse(stdout);
    if (typeof output !== 'object' || output === null) {
      throw new Error('Expected a fetch result object');
    }
    return output as Record<string, unknown>;
  } catch (error) {
    if (cause !== null) {
      if (cause.code === LIGHTPANDA_HTTP_ERROR_EXIT_CODE) {
        throw new WebsiteFetchHttpError(undefined, { cause });
      }
      throw cause;
    }
    throw new Error('lightpanda returned invalid fetch metadata', { cause: error });
  }
}

function assertSuccessfulHttpStatus(result: Record<string, unknown>, cause: ExecFileException | null): void {
  const status = Number.isInteger(result.http_status) ? Number(result.http_status) : undefined;
  if ((status ?? 0) >= 400 || cause?.code === LIGHTPANDA_HTTP_ERROR_EXIT_CODE) {
    throw new WebsiteFetchHttpError(status, { cause: cause ?? undefined });
  }
  if (cause !== null) {
    throw cause;
  }
  if (status === undefined || status < 200) {
    throw new Error('lightpanda did not return successful HTML', { cause: result.error });
  }
}

function assertRendererExit(cause: ExecFileException | null, executable: string): void {
  if (cause === null) return;
  if (cause.code === 'ENOENT') {
    throw new Error(`Lightpanda executable "${executable}" was not found. See docs/lightpanda-runtime.md for setup.`, { cause });
  }
  if (cause.killed || cause.signal != null || typeof cause.code !== 'number') {
    throw cause;
  }
}

export class WebsiteFetcherLightpanda implements WebsiteFetcher {
  public async fetchURL(url: string): Promise<WebsiteFetchResult> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Fetch URL must use http or https: ${url}`);
    }
    await assertPublicDestination(parsed);
    const executable = process.env.LIGHTPANDA_BIN || LIGHTPANDA_DEFAULT_BIN;

    return new Promise((resolve, reject) => {
      let readinessTimer: ReturnType<typeof setTimeout> | undefined;
      let readinessLimitReached = false;
      let completed = false;
      const child = execFile(
        executable,
        [
          'fetch', '--json', '--dump', 'html', '--fail-on-http-error',
          '--wait-until', 'networkidle', '--wait-ms', String(LIGHTPANDA_TIMEOUT_MS),
          '--block-private-networks', '--block-cidrs', LIGHTPANDA_BLOCKED_CIDRS,
          '--http-proxy', '',
          parsed.href,
        ],
        {
          encoding: 'utf8',
          maxBuffer: LIGHTPANDA_MAX_BUFFER_BYTES,
          timeout: LIGHTPANDA_TIMEOUT_MS,
        },
        (error, stdout) => {
          completed = true;
          clearTimeout(readinessTimer);
          if (readinessLimitReached) {
            reject(new Error(`Lightpanda readiness limit exceeded after ${LIGHTPANDA_READINESS_DEADLINE_MS} ms`, {
              cause: error ?? undefined,
            }));
            return;
          }
          try {
            assertRendererExit(error, executable);
            resolve(WebsiteFetcherLightpanda.parseResult(url, stdout, error));
          } catch (error) {
            reject(error);
          }
        },
      );
      if (!completed) {
        readinessTimer = setTimeout(() => {
          if (completed || child.exitCode !== null || child.signalCode !== null) return;
          readinessLimitReached = true;
          child.kill('SIGKILL');
        }, LIGHTPANDA_READINESS_DEADLINE_MS);
      }
    });
  }

  private static parseResult(requestedUrl: string, stdout: string, cause: ExecFileException | null): WebsiteFetchResult {
    const result = readFetchOutput(stdout, cause);
    assertSuccessfulHttpStatus(result, cause);
    if (
      typeof result.url !== 'string'
      || typeof result.content !== 'string'
      || result.error !== null
    ) {
      throw new Error('lightpanda did not return successful HTML', { cause: result.error });
    }
    const finalUrl = new URL(result.url);
    if (finalUrl.protocol !== 'http:' && finalUrl.protocol !== 'https:') {
      throw new Error('lightpanda final URL must use http or https');
    }
    return { requestedUrl, finalUrl: finalUrl.href, html: result.content };
  }
}
