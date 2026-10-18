import { spawn } from 'node:child_process';
import type { TestContext } from 'node:test';

export interface ScriptResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ScriptOptions {
  // Added to a minimal environment that holds only PATH. A PATH value here replaces the inherited one.
  readonly env?: Readonly<Record<string, string>>;
  readonly input?: string;
  readonly keepInputOpen?: boolean;
  readonly cwd?: string;
}

// Runs a command under script/ in a child Node process and collects its exit status and output.
export async function runScript(t: TestContext, script: string, args: readonly string[], options: ScriptOptions = {}): Promise<ScriptResult> {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: options.cwd,
    env: { PATH: process.env.PATH, ...options.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  child.stdin.on('error', () => undefined);
  if (!options.keepInputOpen) child.stdin.end(options.input ?? '');
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
  return new Promise<ScriptResult>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}
