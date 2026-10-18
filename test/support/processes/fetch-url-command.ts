import { spawn } from 'node:child_process';
import type { TestContext } from 'node:test';
import { fetchUrlScript, fetchUrlOAuthEntry } from './module-paths.ts';
import { fetchUrlState } from '../isolation/fetch-url-state.ts';

export async function runFetchUrl(t: TestContext, args: readonly string[], options: { credential?: string; input?: string; keepInputOpen?: boolean; stateDirectory?: string; oauth?: { profile: Record<string, string>; ca: string; interactive?: boolean; authTimeoutMs?: number; redirectUrl?: string; browserAction?: 'wait' | 'cancel'; failSync?: boolean } } = {}) {
  const stateDirectory = options.stateDirectory ?? await fetchUrlState(t);
  const child = spawn(process.execPath, [options.oauth ? fetchUrlOAuthEntry : fetchUrlScript, ...args], {
    env: { PATH: process.env.PATH, XDG_STATE_HOME: stateDirectory, ...(options.oauth ? { THERMUS_TEST_OAUTH: JSON.stringify(options.oauth), NODE_EXTRA_CA_CERTS: options.oauth.ca } : {}), ...(options.credential === undefined ? {} : { THERMUS_API_KEY: options.credential }) },
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
