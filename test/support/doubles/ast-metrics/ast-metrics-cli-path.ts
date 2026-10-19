import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { TestContext } from 'node:test';
import { astMetricsCliFake, gitCliStub } from '../../processes/module-paths.ts';

// The fake writes empty analysis reports and a complete clean review report by default.
export interface AstMetricsCliAnswers {
  readonly version?: string;
  // The OpenMetrics text that analyze writes. {root} stands for the working directory of the call.
  readonly metrics?: string;
  // The JSON report that analyze writes for --report-json. {root} stands for the working directory of the call.
  readonly json?: string;
  // In place of json: the path of a file with the JSON report, from the working directory of the call. Each commit of a
  // test repository can hold its own report, so that a worktree of another commit gets the numbers of its own tree.
  readonly jsonInTree?: string;
  // The Markdown that review prints and writes.
  readonly review?: string;
  // Override the complete JSON review report.
  readonly reviewJson?: string;
  readonly reviewSkipJson?: boolean;
  readonly reviewExitCode?: number;
  readonly reviewStderr?: string;
  // A successful baseline call writes this YAML at the repository root.
  readonly baseline?: string;
  readonly baselineExitCode?: number;
  readonly baselineStderr?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  // analyze and review wait this long before they answer, as a slow analysis does.
  readonly delayMs?: number;
}

export interface AstMetricsCliCall {
  readonly argv: readonly string[];
  readonly cwd: string;
}

export interface AstMetricsCliFake {
  // The environment for runScript: PATH with the fake first, and the answers of the fake.
  readonly env: Readonly<Record<string, string>>;
  calls(): AstMetricsCliCall[];
}

// The folder of the shim, the log, and the answers is removed after the test.
export function astMetricsCliFakeOnPath(t: TestContext, answers: AstMetricsCliAnswers = {}): AstMetricsCliFake {
  const folder = temporaryFolder(t);
  const bin = join(folder, 'bin');
  fs.mkdirSync(bin);
  writeShim(join(bin, 'ast-metrics'), [process.execPath, astMetricsCliFake]);
  const log = join(folder, 'calls.jsonl');
  return {
    env: { PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`, AST_METRICS_FAKE_LOG: log, ...answerSettings(folder, answers) },
    calls: () => recordedCalls(log),
  };
}

// A PATH whose only folder holds git. Thus no ast-metrics executable is on it, also on a host that has one.
export function pathWithoutAstMetrics(t: TestContext): string {
  const bin = temporaryFolder(t);
  writeShim(join(bin, 'git'), [executableOnPath('git')]);
  return bin;
}

// The commit that the stub of git reports for HEAD.
export const gitStubCommit = '0123456789abcdef0123456789abcdef01234567';

// A PATH whose only folder holds a stub of git (git-cli-stub.ts) that reports root as the repository root and
// gitStubCommit as the commit of HEAD. Thus a unit test of a command runs without git and without ast-metrics, as the
// check stage of the hosted image has neither (docs/implementation/test-gate-policy.md).
export function pathWithGitStub(t: TestContext, root: string): string {
  const bin = temporaryFolder(t);
  writeShim(join(bin, 'git'), [process.execPath, gitCliStub, root, gitStubCommit]);
  return bin;
}

const scalarOptions = {
  VERSION: 'version', REVIEW: 'review', REVIEW_JSON: 'reviewJson', REVIEW_EXIT: 'reviewExitCode',
  REVIEW_STDERR: 'reviewStderr', BASELINE: 'baseline', BASELINE_EXIT: 'baselineExitCode',
  BASELINE_STDERR: 'baselineStderr', STDERR: 'stderr', EXIT: 'exitCode', DELAY_MS: 'delayMs',
} as const;

function answerSettings(folder: string, answers: AstMetricsCliAnswers): Record<string, string> {
  const settings = Object.fromEntries(Object.entries(scalarOptions).flatMap(([suffix, key]) => {
    const value = answers[key];
    return value === undefined ? [] : [[`AST_METRICS_FAKE_${suffix}`, String(value)]];
  }));
  if (answers.metrics !== undefined) {
    settings.AST_METRICS_FAKE_METRICS_FILE = join(folder, 'metrics.txt');
    fs.writeFileSync(settings.AST_METRICS_FAKE_METRICS_FILE, answers.metrics);
  }
  if (answers.json !== undefined) {
    settings.AST_METRICS_FAKE_JSON_FILE = join(folder, 'report.json');
    fs.writeFileSync(settings.AST_METRICS_FAKE_JSON_FILE, answers.json);
  }
  if (answers.jsonInTree !== undefined) settings.AST_METRICS_FAKE_JSON_FILE = answers.jsonInTree;
  if (answers.reviewSkipJson) settings.AST_METRICS_FAKE_REVIEW_SKIP_JSON = '1';
  return settings;
}

// The fake writes no log before its first call.
function recordedCalls(log: string): AstMetricsCliCall[] {
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as AstMetricsCliCall);
}

function executableOnPath(name: string): string {
  for (const folder of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(folder, name);
    if (folder !== '' && isExecutableFile(candidate)) return candidate;
  }
  throw new Error(`No ${name} executable is on PATH.`);
}

function isExecutableFile(path: string): boolean {
  try {
    fs.accessSync(path, fs.constants.X_OK);
    return fs.statSync(path).isFile();
  } catch {
    return false;
  }
}

function writeShim(path: string, commandLine: readonly string[]): void {
  fs.writeFileSync(path, `#!/bin/sh\nexec ${commandLine.map(shellWord).join(' ')} "$@"\n`);
  fs.chmodSync(path, 0o755);
}

// The shell takes a word in single quotes literally.
function shellWord(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function temporaryFolder(t: TestContext): string {
  const folder = fs.mkdtempSync(join(tmpdir(), 'thermus-ast-metrics-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return folder;
}
