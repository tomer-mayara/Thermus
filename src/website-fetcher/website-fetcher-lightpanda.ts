import { execFile } from 'node:child_process';
import { assertPublicDestination, LIGHTPANDA_BLOCKED_CIDRS } from './network-policy.ts';
import { type WebsiteFetcher, type WebsiteFetchResult } from './website-fetcher.ts';

const LIGHTPANDA_BIN = 'lightpanda';
const LIGHTPANDA_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const LIGHTPANDA_TIMEOUT_MS = 60_000;
const LIGHTPANDA_WAIT_MS = 5_000;

export class WebsiteFetcherLightpanda implements WebsiteFetcher {
  public async fetchURL(url: string): Promise<WebsiteFetchResult> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Fetch URL must use http or https: ${url}`);
    }
    await assertPublicDestination(parsed);

    const stdout = await new Promise<string>((resolve, reject) => {
      let readinessTimer: ReturnType<typeof setTimeout> | undefined;
      let readinessLimitReached = false;
      let completed = false;
      const child = execFile(
        LIGHTPANDA_BIN,
        [
          'fetch', '--json', '--dump', 'html',
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
            reject(new Error(`Lightpanda readiness limit exceeded after ${LIGHTPANDA_WAIT_MS} ms`, {
              cause: error ?? undefined,
            }));
            return;
          }
          if (error === null) {
            resolve(stdout);
            return;
          }
          if (error.code === 'ENOENT') {
            reject(new Error('lightpanda is not available on PATH'));
            return;
          }
          reject(error);
        },
      );
      if (!completed) {
        readinessTimer = setTimeout(() => {
          readinessLimitReached = true;
          child.kill('SIGKILL');
        }, LIGHTPANDA_WAIT_MS);
      }
    });
    return WebsiteFetcherLightpanda.parseResult(url, stdout);
  }

  private static parseResult(requestedUrl: string, stdout: string): WebsiteFetchResult {
    const result: { url?: unknown; content?: unknown; error?: unknown } | null = JSON.parse(stdout);
    if (
      typeof result?.url !== 'string'
      || typeof result?.content !== 'string'
      || result.error !== null
    ) {
      throw new Error('lightpanda returned an invalid fetch result');
    }
    const finalUrl = new URL(result.url);
    if (finalUrl.protocol !== 'http:' && finalUrl.protocol !== 'https:') {
      throw new Error('lightpanda final URL must use http or https');
    }
    return { requestedUrl, finalUrl: finalUrl.href, html: result.content };
  }
}
