import { spawn, type ChildProcess } from 'node:child_process';
import type { TestContext } from 'node:test';

export interface ScriptResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

// Sends the signal to the command as soon as when gives true. when is checked every 20 ms while the command runs.
interface ScriptStop {
  readonly signal: NodeJS.Signals;
  readonly when: () => boolean;
}

export interface ScriptLine {
  readonly args?: readonly string[];
  // Added to a minimal environment that holds only PATH. A PATH value here replaces the inherited one.
  readonly env?: Readonly<Record<string, string>>;
  readonly input?: string;
  readonly keepInputOpen?: boolean;
  readonly cwd?: string;
  readonly stop?: ScriptStop;
}

// Runs a command under script/ in a child Node process and collects its exit status and output.
export async function runScript(t: TestContext, script: string, line: ScriptLine = {}): Promise<ScriptResult> {
  const child = spawn(process.execPath, [script, ...(line.args ?? [])], {
    cwd: line.cwd,
    env: { PATH: process.env.PATH, ...line.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  if (line.stop) stopWhenReady(child, line.stop);
  child.stdin.on('error', () => undefined);
  if (!line.keepInputOpen) child.stdin.end(line.input ?? '');
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
  return new Promise<ScriptResult>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function stopWhenReady(child: ChildProcess, stop: ScriptStop): void {
  const timer = setInterval(() => {
    if (!stop.when()) return;
    clearInterval(timer);
    child.kill(stop.signal);
  }, 20);
  child.once('exit', () => clearInterval(timer));
}
