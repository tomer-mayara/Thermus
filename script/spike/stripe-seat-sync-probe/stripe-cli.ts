import { spawn, type ChildProcess } from 'node:child_process';
import { objectName, PROBE_TAG } from './context.ts';
import { redact } from './secrets.ts';

// The Stripe CLI uses its own login (stripe login), in test mode: the probe passes no --live and no key. The child
// gets no secret of the probe, and no STRIPE_API_KEY, which would replace the login of the CLI.
const CLI = 'stripe';
const OUTPUT_LIMIT = 64 * 1024;
const HIDDEN_VARIABLES = ['STRIPE_RESTRICTED_KEY', 'STRIPE_API_KEY', 'WORKOS_API_KEY', 'WORKOS_CLIENT_ID', 'WORKOS_AUTHKIT_ISSUER'];
const READY_LIMIT_MS = 60_000;
const STOP_LIMIT_MS = 5_000;
const SIGNING_SECRET = /^whsec_[A-Za-z0-9]+$/;

export interface CliResult {
  readonly code: number | null;
  // Raw output. It can hold the signing secret: print it only through tail().
  readonly output: string;
  readonly ms: number;
}

export interface Limits {
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

function cliEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of HIDDEN_VARIABLES) delete environment[name];
  return environment;
}

export function tail(output: string): string {
  return redact(output.trim().split('\n').slice(-4).join(' / '));
}

function start(args: readonly string[]): ChildProcess {
  return spawn(CLI, [...args], { env: cliEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
}

export function runCli(args: readonly string[], limits: Limits): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = start(args);
    let output = '';
    const keep = (chunk: Buffer): void => {
      output = `${output}${chunk.toString('utf8')}`.slice(-OUTPUT_LIMIT);
    };
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);
    const stop = (): boolean => child.kill('SIGTERM');
    const timer = setTimeout(stop, limits.timeoutMs);
    limits.signal.addEventListener('abort', stop, { once: true });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`The Stripe CLI did not start (${error.message}). Install it and sign in with stripe login: see the owner steps of the record.`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      limits.signal.removeEventListener('abort', stop);
      resolve({ code, output, ms: performance.now() - started });
    });
  });
}

export async function cliVersion(signal: AbortSignal): Promise<string> {
  const result = await runCli(['--version'], { timeoutMs: 15_000, signal });
  if (result.code !== 0) throw new Error(`stripe --version gave exit code ${result.code ?? 'none'}: ${tail(result.output)}`);
  return redact(result.output.trim().split('\n')[0] ?? 'unknown');
}

// The secret of the CLI forwarding. The Stripe CLI reference says that it does not change between restarts of
// stripe listen. It stays in memory.
export async function readSigningSecret(signal: AbortSignal): Promise<string> {
  const result = await runCli(['listen', '--print-secret'], { timeoutMs: 30_000, signal });
  const secret = result.output.trim();
  if (result.code !== 0 || !SIGNING_SECRET.test(secret)) {
    throw new Error(`stripe listen --print-secret gave exit code ${result.code ?? 'none'} and no signing secret: ${tail(result.output)}. Sign in with stripe login.`);
  }
  return secret;
}

// The command as a person types it in a shell. Real mode passes the arguments to the CLI with no shell.
export function shellLine(args: readonly string[]): string {
  return ['stripe', ...args].map((arg) => (/^[\w./:=@,{}+-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`)).join(' ');
}

export function listenArgs(url: string, events: readonly string[]): readonly string[] {
  return ['listen', '--forward-to', url, '--events', events.join(',')];
}

// The CLI fixture of customer.subscription.created makes a customer, a product, a price, and a subscription. The
// probe skips the product and the price, so that the subscription uses the price of the run, and every object that
// the trigger makes carries the run token and can be deleted.
export function triggerArgs(run: string, priceId: string): readonly string[] {
  return [
    'trigger', 'customer.subscription.created', '--skip', 'product', '--skip', 'price',
    '--override', `subscription:items[0].price=${priceId}`,
    '--override', `customer:description=${objectName(run, 'webhook')}`,
    '--add', `customer:name=${objectName(run, 'webhook')}`,
    '--add', `customer:metadata.thermus_probe=${PROBE_TAG}`, '--add', `customer:metadata.thermus_probe_run=${run}`,
    '--add', `subscription:metadata.thermus_probe=${PROBE_TAG}`, '--add', `subscription:metadata.thermus_probe_run=${run}`,
  ];
}

// stripe listen as a child process, until stop().
export class ListenSession {
  readonly #child: ChildProcess;
  #output = '';

  private constructor(child: ChildProcess) {
    this.#child = child;
    const keep = (chunk: Buffer): void => {
      this.#output = `${this.#output}${chunk.toString('utf8')}`.slice(-OUTPUT_LIMIT);
    };
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);
  }

  public static async start(url: string, events: readonly string[], signal: AbortSignal): Promise<ListenSession> {
    const session = new ListenSession(start(listenArgs(url, events)));
    await session.#ready(signal);
    return session;
  }

  public output(): string {
    return tail(this.#output);
  }

  async #ready(signal: AbortSignal): Promise<void> {
    const deadline = performance.now() + READY_LIMIT_MS;
    while (!this.#output.includes('Ready!')) {
      if (this.#child.exitCode !== null) throw new Error(`stripe listen stopped with exit code ${this.#child.exitCode}: ${this.output()}`);
      if (performance.now() > deadline || signal.aborted) {
        await this.stop();
        throw new Error(`stripe listen was not ready within ${READY_LIMIT_MS / 1_000} s: ${this.output()}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  public async stop(): Promise<void> {
    if (this.#child.exitCode !== null || this.#child.signalCode !== null) return;
    const closed = new Promise((resolve) => this.#child.once('close', resolve));
    this.#child.kill('SIGTERM');
    const timer = setTimeout(() => this.#child.kill('SIGKILL'), STOP_LIMIT_MS);
    await closed;
    clearTimeout(timer);
  }
}
