import { spawn } from 'node:child_process';
import type { TestContext } from 'node:test';
import { fetchUrlScript } from './module-paths.ts';

export async function runFetchUrl(t: TestContext, args: readonly string[], options: { credential?: string; input?: string; keepInputOpen?: boolean } = {}) {
  const child = spawn(process.execPath, [fetchUrlScript, ...args], {
    env: { PATH: process.env.PATH, ...(options.credential === undefined ? {} : { THERMUS_API_KEY: options.credential }) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  child.stdin.on('error', () => undefined);
  if (!options.keepInputOpen) child.stdin.end(options.input ?? '');
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}
