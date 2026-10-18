import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { TestContext } from 'node:test';
import type { AstMetricsCliAnswers } from '../../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import type { AstMetricsMcpAnswers } from '../../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';
import { fileMetricsAnswers, jsonReport, repositoryFiles, serverAnswers, snapshotDoublesOnPath, type SnapshotDoubles } from './ast-metrics-snapshot-answers.ts';
import { GitRepository } from './git-repository.ts';

export const worktreePrefix = 'thermus-snapshot-base-';

// Each commit of a test repository holds, at this path, the JSON report that the fake of "ast-metrics analyze" gives
// for its tree. Thus a worktree of the merge base gets the numbers of the merge base, and not those of the branch.
const reportInTree = 'ast-metrics-fake-report.json';

type ReportEntry = { readonly path: string } & Readonly<Record<string, unknown>>;

const { concernedFiles } = JSON.parse(jsonReport) as { readonly concernedFiles: readonly ReportEntry[] };

// The report of the snapshot answers, with each entry here in place of the entry for its path, or added.
function reportWith(...entries: readonly ReportEntry[]): string {
  const paths = new Set(entries.map(({ path }) => path));
  return JSON.stringify({ concernedFiles: [...concernedFiles.filter(({ path }) => !paths.has(path)), ...entries] });
}

// main holds the files and the report of the snapshot answers, and the branch feature has no commit of its own. Thus
// HEAD is the merge base of main and HEAD.
export function baseRepository(t: TestContext): GitRepository {
  return GitRepository.onFeatureBranch(t, { ...repositoryFiles, [reportInTree]: jsonReport });
}

// After the fork, the branch feature changes src/auth/session.ts and adds src/auth/audit.ts, and main changes
// src/kernel/ids.ts. The report of each commit gives these files other numbers, so a snapshot shows the tree that it
// measured. HEAD is the commit of the branch.
export function forkedRepository(t: TestContext): { readonly repository: GitRepository; readonly mergeBase: string } {
  const repository = baseRepository(t);
  const mergeBase = repository.git('rev-parse', 'HEAD').trim();
  repository.commit('Change the session and add the audit', {
    'src/auth/session.ts': 'export const value = 2;\n',
    'src/auth/audit.ts': 'export const audit = 1;\n',
    [reportInTree]: reportWith(
      { path: '{root}/src/auth/session.ts', complexity: { cyclomatic: 9 }, volume: { loc: 130 }, maintainability: { maintainabilityIndex: 55.5 }, risk: { score: 0.4 } },
      { path: '{root}/src/auth/audit.ts', complexity: { cyclomatic: 2 }, volume: { loc: 30 }, maintainability: { maintainabilityIndex: 90 }, risk: {} },
    ),
  });
  repository.git('switch', '--quiet', 'main');
  repository.commit('Change the ids', {
    'src/kernel/ids.ts': 'export const value = 2;\n',
    [reportInTree]: reportWith({ path: '{root}/src/kernel/ids.ts', complexity: { cyclomatic: 1 }, volume: { loc: 12 }, maintainability: { maintainabilityIndex: 99 }, risk: {} }),
  });
  repository.git('switch', '--quiet', 'feature');
  return { repository, mergeBase };
}

// The answers of the server for the tree of the branch of forkedRepository: the snapshot answers, and the metrics of the
// added file. The other trees do not have that file, so the same answers serve them too.
export const forkedServerAnswers: AstMetricsMcpAnswers = {
  ...serverAnswers,
  get_file_metrics: {
    ...fileMetricsAnswers,
    'src/auth/audit.ts': {
      path: 'src/auth/audit.ts', language: 'TypeScript', cyclomatic_complexity: 2, risk_score: 0,
      functions: [{ name: 'audit', cyclomatic_complexity: 2, maintainability: { comment_weight: 0, maintainability_index: 90 }, volume: { loc: 5, lloc: 3 } }],
    },
  },
};

export interface BaseSnapshotDoubles extends SnapshotDoubles {
  // The real path of the system temporary folder of the command. TMPDIR names a new folder of the test, so that the
  // test sees each folder that the command leaves there.
  readonly temporaryFolder: string;
}

// The doubles of the snapshot answers, but the fake of analyze reads the report of the tree that it runs in. The CLI
// answers here are added, such as a failure, and the server answers replace those of the snapshot.
export function baseDoublesOnPath(t: TestContext, cli: AstMetricsCliAnswers = {}, server: AstMetricsMcpAnswers = serverAnswers): BaseSnapshotDoubles {
  const doubles = snapshotDoublesOnPath(t, { cli: { jsonInTree: reportInTree, ...cli }, server });
  const temporary = dataDirectory(t);
  return { ...doubles, env: { ...doubles.env, TMPDIR: temporary }, temporaryFolder: realpathSync(temporary) };
}

export function worktreesOf(repository: GitRepository): string[] {
  const lines = repository.git('worktree', 'list', '--porcelain').split('\n');
  return lines.filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
}

export function foldersLeftIn(doubles: BaseSnapshotDoubles): string[] {
  return readdirSync(doubles.temporaryFolder).filter((name) => name.startsWith(worktreePrefix)).map((name) => join(doubles.temporaryFolder, name));
}

// The command names the folder of its worktree by the id of its process, and the folder of an interrupted run stays.
export function runFolderOf(doubles: BaseSnapshotDoubles, pid: number): string {
  return join(doubles.temporaryFolder, `${worktreePrefix}${pid}-Ab12Cd`);
}

// The id of a process that has ended, as the process of an interrupted run.
export function endedProcessId(): number {
  return spawnSync(process.execPath, ['--version']).pid;
}

// A post-checkout hook that touches the marker file, as a hook that installs packages acts in each new tree.
export function installCheckoutHook(repository: GitRepository, marker: string): void {
  const hooks = join(repository.root, '.git', 'hooks');
  mkdirSync(hooks, { recursive: true });
  writeFileSync(join(hooks, 'post-checkout'), `#!/bin/sh\ntouch ${shellWord(marker)}\n`, { mode: 0o755 });
}

// A saboteur of the cleanup: the PATH of the doubles, with a git first that refuses "git worktree remove" of the folder,
// or of each folder, and runs the real git for each other command. The worktree then stays until the test removes its
// folders.
export function pathWithGitThatKeepsWorktrees(t: TestContext, path: string, folder = ''): string {
  const bin = dataDirectory(t);
  const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const script = [
    '#!/bin/sh',
    'if [ "$1" = worktree ] && [ "$2" = remove ]; then',
    `  case "$*" in *${shellWord(folder)}*) echo "fatal: the test keeps the worktree" >&2; exit 128;; esac`,
    'fi',
    `exec ${shellWord(realGit)} "$@"`,
  ];
  writeFileSync(join(bin, 'git'), `${script.join('\n')}\n`, { mode: 0o755 });
  return `${bin}${delimiter}${path}`;
}

// The shell takes a word in single quotes literally.
function shellWord(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}
