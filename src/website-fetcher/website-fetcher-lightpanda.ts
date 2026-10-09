import { execFile } from 'node:child_process';
import { assertPublicDestination, LIGHTPANDA_BLOCKED_CIDRS } from './network-policy.ts';
import { type WebsiteFetcher } from './website-fetcher.ts';

const LIGHTPANDA_BIN = 'lightpanda';
const LIGHTPANDA_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const LIGHTPANDA_TIMEOUT_MS = 60_000;
const LIGHTPANDA_WAIT_MS = 5_000;

export class WebsiteFetcherLightpanda implements WebsiteFetcher {
  public async fetchURL(url: string): Promise<string> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Fetch URL must use http or https: ${url}`);
    }
    await assertPublicDestination(parsed);

    return new Promise((resolve, reject) => {
      let readinessTimer: ReturnType<typeof setTimeout> | undefined;
      let readinessLimitReached = false;
      let completed = false;
      const child = execFile(
        LIGHTPANDA_BIN,
        [
          'fetch', '--dump', 'html',
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
  }
}
