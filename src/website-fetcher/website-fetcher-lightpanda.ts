import { execFile, type ChildProcess, type ExecFileException } from 'node:child_process';
import { PublicDestinationPolicy, LIGHTPANDA_BLOCKED_CIDRS } from './network-policy.ts';
import { systemErrorName, WEBSITE_FETCH_READINESS_BUDGET_MS, WebsiteFetchHttpError, WebsiteFetchLaunchError, WebsiteFetchReadinessTimeoutError, type WebsiteFetcher, type WebsiteFetchResult } from './website-fetcher.ts';

const LIGHTPANDA_DEFAULT_BIN = 'lightpanda';
const LIGHTPANDA_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const LIGHTPANDA_TIMEOUT_MS = 60_000;
const LIGHTPANDA_HTTP_ERROR_EXIT_CODE = 22;
const SYSTEM_LIMIT_CODES = new Set<unknown>(['EAGAIN', 'EMFILE', 'ENFILE', 'ENOMEM']);

function rendererArguments(url: string): string[] {
  return [
    'fetch', '--json', '--dump', 'html', '--fail-on-http-error',
    '--wait-until', 'networkidle', '--wait-ms', String(LIGHTPANDA_TIMEOUT_MS),
    '--block-private-networks', '--block-cidrs', LIGHTPANDA_BLOCKED_CIDRS,
    '--http-proxy', '',
    url,
  ];
}

// Lightpanda 1.0.0 sends telemetry to telemetry.lightpanda.io on each run, also a fetch run, unless this variable is
// set. A local server environment often does not set it, so each run gets it with the rest of the server environment.
function rendererEnvironment(): NodeJS.ProcessEnv {
  return { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: 'true' };
}

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
  const launchFailure = launchError(cause, executable);
  if (launchFailure !== undefined) throw launchFailure;
  if (cause.killed || cause.signal != null || typeof cause.code !== 'number') {
    throw cause;
  }
}

// Node marks the error of a process that cannot start with the syscall "spawn". A system limit is temporary and not a
// setup failure, so it stays a process error. The process error repeats the arguments with the URL, so it stays only
// the cause.
function launchError(error: unknown, executable: string): WebsiteFetchLaunchError | undefined {
  const { syscall, code } = (error ?? {}) as { syscall?: unknown; code?: unknown };
  if (typeof syscall !== 'string' || !syscall.startsWith('spawn') || SYSTEM_LIMIT_CODES.has(code)) return undefined;
  const name = systemErrorName(code);
  const problem = name === 'ENOENT' ? 'was not found' : `could not start (${name})`;
  return new WebsiteFetchLaunchError(name, `Lightpanda executable "${executable}" ${problem}. See docs/lightpanda-runtime.md for setup.`, { cause: error });
}

export class WebsiteFetcherLightpanda implements WebsiteFetcher {
  private readonly executable: string;
  private readonly destinations = new PublicDestinationPolicy();

  // An empty value selects lightpanda on PATH, as an unset LIGHTPANDA_BIN does.
  public constructor(executable?: string) {
    this.executable = executable || LIGHTPANDA_DEFAULT_BIN;
  }

  public async fetchURL(url: string, signal?: AbortSignal): Promise<WebsiteFetchResult> {
    signal?.throwIfAborted();
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Fetch URL must use http or https: ${url}`);
    }
    try {
      await this.destinations.assertPublicDestination(parsed, signal);
    } catch (error) {
      signal?.throwIfAborted();
      throw error;
    }
    signal?.throwIfAborted();
    return this.render(parsed.href, url, signal);
  }

  private render(url: string, requestedUrl: string, signal?: AbortSignal): Promise<WebsiteFetchResult> {
    return new Promise((resolve, reject) => {
      let readinessTimer: ReturnType<typeof setTimeout> | undefined;
      let readinessLimitReached = false;
      let completed = false;
      let resourcesReleased = false;
      let killRequested = false;
      let child: ChildProcess | undefined;
      const releaseResources = () => {
        if (resourcesReleased) return;
        resourcesReleased = true;
        clearTimeout(readinessTimer);
        signal?.removeEventListener('abort', cancel);
      };
      const stopChild = () => {
        if (!completed && !killRequested && child?.exitCode === null && child.signalCode === null) {
          killRequested = true;
          child.kill('SIGKILL');
        }
      };
      const cancel = () => {
        releaseResources();
        stopChild();
      };
      const cleanup = () => {
        completed = true;
        releaseResources();
      };
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        child = this.startRenderer(url, (error, stdout) => {
          if (completed) return;
          cleanup();
          try {
            signal?.throwIfAborted();
            if (readinessLimitReached) {
              throw new WebsiteFetchReadinessTimeoutError({
                cause: error ?? undefined,
              });
            }
            assertRendererExit(error, this.executable);
            const result = WebsiteFetcherLightpanda.parseResult(requestedUrl, stdout, error);
            signal?.throwIfAborted();
            resolve(result);
          } catch (error) {
            reject(signal?.aborted ? signal.reason : error);
          }
        });
        if (signal?.aborted) cancel();
        if (!completed && !signal?.aborted) {
          readinessTimer = setTimeout(() => {
            if (completed || child?.exitCode !== null || child.signalCode !== null) return;
            readinessLimitReached = true;
            stopChild();
          }, WEBSITE_FETCH_READINESS_BUDGET_MS);
        }
      } catch (error) {
        cleanup();
        reject(signal?.aborted ? signal.reason : error);
      }
    });
  }

  // Node refuses some starts at once, for example with ENOEXEC. They become launch errors, as the later ones do.
  private startRenderer(url: string, complete: (error: ExecFileException | null, stdout: string) => void): ChildProcess {
    try {
      return execFile(this.executable, rendererArguments(url), {
        encoding: 'utf8',
        env: rendererEnvironment(),
        maxBuffer: LIGHTPANDA_MAX_BUFFER_BYTES,
        timeout: LIGHTPANDA_TIMEOUT_MS,
      }, complete);
    } catch (error) {
      throw launchError(error, this.executable) ?? error;
    }
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
