import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const commandEntry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
const networkBlocker = new URL('./deny-network.js', import.meta.url).href;

export type CommandSettings = Readonly<Record<string, string>>;

export interface CommandOptions {
  readonly denyNetwork?: boolean;
}

export interface CommandResult {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

// The command reads passwords from standard input, so the arguments never carry them.
export class CommandProcess {
  private readonly child: ChildProcessByStdio<Writable, Readable, Readable>;
  private readonly exit: Promise<CommandResult>;
  private stdoutText = '';
  private stderrText = '';
  private readonly stderrListeners = new Set<() => void>();

  private constructor(settings: CommandSettings, args: readonly string[], options: CommandOptions) {
    const preload = options.denyNetwork === true ? ['--import', networkBlocker] : [];
    this.child = spawn(process.execPath, [...preload, commandEntry, ...args], { env: { ...settings }, stdio: ['pipe', 'pipe', 'pipe'] });
    // A command that stops before it reads its input closes the pipe; that is not a test failure.
    this.child.stdin.on('error', () => undefined);
    this.child.stdout.setEncoding('utf8').on('data', (chunk: string) => { this.stdoutText += chunk; });
    this.child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      this.stderrText += chunk;
      for (const listener of this.stderrListeners) listener();
    });
    this.exit = once(this.child, 'close').then(([code, signal]) => ({
      code,
      signal,
      stdout: this.stdoutText,
      stderr: this.stderrText,
    }));
  }

  static launch(t: TestContext, settings: CommandSettings, args: readonly string[], options: CommandOptions = {}): CommandProcess {
    const command = new CommandProcess(settings, args, options);
    t.after(() => command.kill());
    return command;
  }

  get stderr(): string {
    return this.stderrText;
  }

  async stderrMatches(pattern: RegExp): Promise<boolean> {
    const matched = new Promise<boolean>((resolve) => {
      const check = (): void => {
        if (!pattern.test(this.stderrText)) return;
        this.stderrListeners.delete(check);
        resolve(true);
      };
      this.stderrListeners.add(check);
      check();
    });
    return Promise.race([matched, this.exit.then(() => pattern.test(this.stderrText))]);
  }

  answer(lines: readonly string[]): void {
    for (const line of lines) this.child.stdin.write(`${line}\n`);
    this.child.stdin.end();
  }

  async result(): Promise<CommandResult> {
    return this.exit;
  }

  private kill(): void {
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGKILL');
  }
}

export async function runCommand(
  t: TestContext,
  settings: CommandSettings,
  args: readonly string[],
  input: readonly string[] = [],
): Promise<CommandResult> {
  const command = CommandProcess.launch(t, settings, args, { denyNetwork: true });
  command.answer(input);
  return command.result();
}

export function assertExit(result: CommandResult, code: number): void {
  assert.equal(result.code, code, `exit ${result.code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

export function assertRevealsNone(results: readonly CommandResult[], secrets: readonly string[]): void {
  for (const { stdout, stderr } of results) {
    for (const secret of secrets) {
      assert.ok(!stdout.includes(secret), 'a password appeared on standard output');
      assert.ok(!stderr.includes(secret), 'a password appeared on standard error');
    }
    assert.doesNotMatch(stderr, /Outbound network access/);
  }
}
