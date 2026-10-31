import { parseRendererResult } from './renderer-result.ts';
import { WebsiteFetchFailure, processDiagnostic } from './fetch-diagnostic.ts';
import { execFile, type ChildProcess, type ExecFileException } from 'node:child_process';
import { PublicDestinationPolicy, LIGHTPANDA_BLOCKED_CIDRS } from './network-policy.ts';
import { systemErrorName, WEBSITE_FETCH_READINESS_BUDGET_MS, WebsiteFetchLaunchError, WebsiteFetchReadinessTimeoutError, type WebsiteFetcher, type WebsiteFetchResult } from './website-fetcher.ts';

const LIGHTPANDA_DEFAULT_BIN = 'lightpanda';
const LIGHTPANDA_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const LIGHTPANDA_TIMEOUT_MS = 60_000;
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

function assertRendererExit(cause: ExecFileException | null, executable: string): void {
  if (cause === null) return;
  const launchFailure = launchError(cause, executable);
  if (launchFailure !== undefined) throw launchFailure;
}

// Node marks the error of a process that cannot start with the syscall "spawn". A system limit is temporary and not a
// setup failure, so it stays a process error. The process error repeats the arguments with the URL, so it stays only
// the cause.
function launchError(error: unknown, executable: string): WebsiteFetchLaunchError | undefined {
  const { syscall, code } = (error ?? {}) as { syscall?: unknown; code?: unknown };
  if (typeof syscall !== 'string' || !syscall.startsWith('spawn') || SYSTEM_LIMIT_CODES.has(code)) return undefined;
  const name = systemErrorName(code);
  const problem = name === 'ENOENT' ? 'was not found' : `could not start (${name})`;
  return new WebsiteFetchLaunchError(name, `Lightpanda executable "${executable}" ${problem}. See docs/lightpanda-runtime.md for setup.`, { cause: error }, { category: 'launch', phase: 'renderer_launch', ...processDiagnostic(error as ExecFileException) });
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
    let parsed: URL;
    try { parsed = new URL(url); } catch (cause) {
      throw new WebsiteFetchFailure('Invalid URL', { category: 'validation', phase: 'url_validation', reason: 'invalid_url' }, { cause });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new WebsiteFetchFailure(`Fetch URL must use http or https: ${url}`, { category: 'validation', phase: 'url_validation', reason: 'unsupported_protocol' });
    }
    try {
      await this.destinations.assertPublicDestination(parsed, signal);
    } catch (error) {
      signal?.throwIfAborted();
      throw error instanceof WebsiteFetchFailure ? error : new WebsiteFetchFailure((error as Error).message, { category: 'unknown', phase: 'destination_policy', ...processDiagnostic(error) }, { cause: error });
    }
    signal?.throwIfAborted();
    return new RendererRun(this.executable, { url: parsed.href, requestedUrl: url }, signal).result();
  }

}

interface RenderTarget {
  readonly url: string;
  readonly requestedUrl: string;
}

class RendererRun {
  private readonly settled = Promise.withResolvers<WebsiteFetchResult>();
  private readinessTimer: ReturnType<typeof setTimeout> | undefined;
  private readinessLimitReached = false;
  private completed = false;
  private resourcesReleased = false;
  private killRequested = false;
  private child: ChildProcess | undefined;
  private readonly cancel = (): void => {
    this.releaseResources();
    this.stopChild();
  };

  public constructor(private readonly executable: string, private readonly target: RenderTarget, private readonly signal?: AbortSignal) {}

  public result(): Promise<WebsiteFetchResult> {
    this.signal?.addEventListener('abort', this.cancel, { once: true });
    try {
      this.child = startRenderer(this.executable, this.target.url, (error, stdout) => this.receive(error, stdout));
      if (this.signal?.aborted) this.cancel();
      this.armReadinessLimit();
    } catch (error) {
      this.cleanup();
      this.fail(error);
    }
    return this.settled.promise;
  }

  private armReadinessLimit(): void {
    if (this.completed || this.signal?.aborted) return;
    this.readinessTimer = setTimeout(() => this.expireReadiness(), WEBSITE_FETCH_READINESS_BUDGET_MS);
  }

  private receive(error: ExecFileException | null, stdout: string): void {
    if (this.completed) return;
    this.cleanup();
    try {
      this.settled.resolve(this.page(error, stdout));
    } catch (failure) {
      this.fail(failure);
    }
  }

  private page(error: ExecFileException | null, stdout: string): WebsiteFetchResult {
    this.signal?.throwIfAborted();
    if (this.readinessLimitReached) {
      throw new WebsiteFetchReadinessTimeoutError({
        cause: error ?? undefined,
      }, { category: 'readiness_timeout', phase: 'renderer_process', budgetMs: WEBSITE_FETCH_READINESS_BUDGET_MS, ...processDiagnostic(error) });
    }
    assertRendererExit(error, this.executable);
    const result = parseRendererResult(this.target.requestedUrl, stdout, error);
    this.signal?.throwIfAborted();
    return result;
  }

  private fail(error: unknown): void {
    this.settled.reject(this.signal?.aborted ? this.signal.reason : error);
  }

  private expireReadiness(): void {
    if (this.completed || this.child?.exitCode !== null || this.child.signalCode !== null) return;
    this.readinessLimitReached = true;
    this.stopChild();
  }

  private stopChild(): void {
    if (!this.completed && !this.killRequested && this.child?.exitCode === null && this.child.signalCode === null) {
      this.killRequested = true;
      this.child.kill('SIGKILL');
    }
  }

  private releaseResources(): void {
    if (this.resourcesReleased) return;
    this.resourcesReleased = true;
    clearTimeout(this.readinessTimer);
    this.signal?.removeEventListener('abort', this.cancel);
  }

  private cleanup(): void {
    this.completed = true;
    this.releaseResources();
  }
}

// Node refuses some starts at once, for example with ENOEXEC. They become launch errors, as the later ones do.
function startRenderer(executable: string, url: string, complete: (error: ExecFileException | null, stdout: string) => void): ChildProcess {
  try {
    return execFile(executable, rendererArguments(url), {
      encoding: 'utf8',
      env: rendererEnvironment(),
      maxBuffer: LIGHTPANDA_MAX_BUFFER_BYTES,
      timeout: LIGHTPANDA_TIMEOUT_MS,
    }, complete);
  } catch (error) {
    throw launchError(error, executable) ?? new WebsiteFetchFailure('Renderer process failed', { category: 'unknown', phase: 'renderer_launch', ...processDiagnostic(error as ExecFileException) }, { cause: error });
  }
}
