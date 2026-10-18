import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { dataDirectory } from '../../isolation/data-directory.ts';
import { astMetricsMcpFake } from '../../processes/module-paths.ts';

// The paths that get_file_metrics of the fake knows. The answer for the second has no file-level maintainability.
export const knownFile = 'src/known.ts';
export const unscoredFile = 'src/unscored.ts';

// The answers for the files of a test repository, keyed by tool name: get_communities answers its value as JSON, and
// get_file_metrics answers the value of its path, or the error of the real server for each other path.
export interface AstMetricsMcpAnswers {
  readonly get_communities?: unknown;
  readonly get_file_metrics?: Readonly<Record<string, unknown>>;
}

// hang: the fake never answers a tools/call. exit-early: it exits with status 3 after its answer to initialize.
// text: each tool other than get_file_metrics answers this plain text instead of JSON.
export interface AstMetricsMcpFakeSettings {
  readonly mode?: 'hang' | 'exit-early';
  readonly text?: string;
  readonly answers?: AstMetricsMcpAnswers;
}

export interface AstMetricsMcpFakeRequest {
  readonly method: string;
  readonly tool?: string;
  readonly arguments?: unknown;
  readonly pid: number;
  readonly cwd: string;
}

export interface AstMetricsMcpFakeOnPath {
  // The env option of runScript: PATH with the fake first, and the settings of the fake.
  readonly env: Readonly<Record<string, string>>;
  // Empty when no fake process started.
  requests(): AstMetricsMcpFakeRequest[];
  calls(): Pick<AstMetricsMcpFakeRequest, 'tool' | 'arguments' | 'cwd'>[];
  // A stopped process can stay for a short time until the system collects it, so this waits up to one second for each
  // process before it names the process as running.
  stillRunning(): Promise<number[]>;
}

// Puts an executable file named ast-metrics in a new folder. It runs the fake of the MCP server with the Node
// runtime of the test. The folder goes first on PATH, so a command under test starts the fake.
export function astMetricsMcpFakeOnPath(t: TestContext, settings: AstMetricsMcpFakeSettings = {}): AstMetricsMcpFakeOnPath {
  const directory = dataDirectory(t);
  const bin = join(directory, 'bin');
  const log = join(directory, 'requests.jsonl');
  mkdirSync(bin);
  writeFileSync(join(bin, 'ast-metrics'), `#!/bin/sh\nexec "${process.execPath}" "${astMetricsMcpFake}" "$@"\n`, { mode: 0o755 });
  const env: Record<string, string> = { PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`, AST_METRICS_FAKE_REQUEST_LOG: log };
  if (settings.mode === 'hang') env.AST_METRICS_FAKE_HANG = '1';
  if (settings.mode === 'exit-early') env.AST_METRICS_FAKE_EXIT_EARLY = '1';
  if (settings.text !== undefined) env.AST_METRICS_FAKE_TEXT = settings.text;
  if (settings.answers !== undefined) {
    env.AST_METRICS_FAKE_ANSWERS = join(directory, 'answers.json');
    writeFileSync(env.AST_METRICS_FAKE_ANSWERS, JSON.stringify(settings.answers));
  }
  const requests = (): AstMetricsMcpFakeRequest[] => (existsSync(log) ? readFileSync(log, 'utf8').split('\n') : [])
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as AstMetricsMcpFakeRequest);
  return {
    env,
    requests,
    calls: () => requests().filter((request) => request.method === 'tools/call').map(({ tool, arguments: values, cwd }) => ({ tool, arguments: values, cwd })),
    stillRunning: () => runningProcesses(new Set(requests().map((request) => request.pid))),
  };
}

async function runningProcesses(pids: Iterable<number>): Promise<number[]> {
  const running: number[] = [];
  for (const pid of pids) {
    for (let attempt = 0; attempt < 20 && processExists(pid); attempt += 1) await delay(50);
    if (processExists(pid)) running.push(pid);
  }
  return running;
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}
