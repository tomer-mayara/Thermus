import { git } from '../code-quality/shared/repository.ts';
import { blobsAt } from './blobs.ts';
import { changesOf, numstatOf, type NumstatRow } from './changes.ts';
import { isTypeScript } from './code-files.ts';
import { exceptionsPath } from './exceptions.ts';
import type { SnapshotPair } from './snapshots.ts';
import type { Change } from './types.ts';

const snoozePath = '.habit-hooks/snooze.json';
const settingsPaths = [snoozePath, exceptionsPath];
const diffOptions = ['-M', '--no-color', '--no-ext-diff', '--no-textconv'];

// The check resolves HEAD once, so that every read sees the same commit.
export interface Revisions {
  readonly head: string;
  readonly mergeBase: string;
}

// The check reads files from git, so an uncommitted change is not part of the candidate. sourcePaths holds every
// path under src/ at HEAD; sources holds the TypeScript files among them.
export interface Candidate extends Revisions {
  readonly changes: readonly Change[];
  readonly numstat: readonly NumstatRow[];
  readonly productionNumstat: readonly NumstatRow[];
  readonly testDiff: string;
  readonly sourcePaths: readonly string[];
  readonly sources: ReadonlyMap<string, string>;
  readonly snooze?: string;
  readonly exceptions?: string;
  readonly today: string;
  readonly snapshots?: SnapshotPair;
  readonly dirty: boolean;
}

export function revisionsOf(root: string, base: string): Revisions {
  const head = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], 'HEAD does not name a commit. Make a commit first.').trim();
  return { head, mergeBase: git(root, ['merge-base', base, head], `The base ref "${base}" and HEAD have no common commit.`).trim() };
}

export function isDirty(root: string): boolean {
  return git(root, ['--no-optional-locks', 'status', '--porcelain', '--untracked-files=normal'], 'git status failed.').trim() !== '';
}

// production holds the patterns of scopes.production. Git limits a second numstat to them, so that a file that moves
// into the scope counts all its lines.
export function candidateOf(root: string, revisions: Revisions, production: readonly string[]): Omit<Candidate, 'dirty' | 'snapshots'> {
  const diff = (args: readonly string[], paths: readonly string[] = []) => git(root,
    ['-c', 'core.quotePath=false', 'diff', ...diffOptions, ...args, revisions.mergeBase, revisions.head, '--', ...paths],
    'git diff could not compare the merge base with HEAD.');
  const sourcePaths = git(root, ['ls-tree', '-r', '-z', '--name-only', revisions.head, '--', 'src'], 'git ls-tree could not list the files of HEAD.').split('\0').filter(Boolean);
  const files = blobsAt(root, revisions.head, [...sourcePaths.filter(isTypeScript), ...settingsPaths]);
  return {
    ...revisions,
    changes: changesOf(diff(['--name-status', '-z'])),
    numstat: numstatOf(diff(['--numstat', '-z'])),
    productionNumstat: production.length > 0 ? numstatOf(diff(['--numstat', '-z'], production.map((pattern) => `:(glob)${pattern}`))) : [],
    testDiff: diff(['-U0', '--no-prefix'], ['test']),
    sourcePaths,
    sources: new Map([...files].filter(([path]) => !settingsPaths.includes(path))),
    snooze: files.get(snoozePath),
    exceptions: files.get(exceptionsPath),
    today: git(root, ['show', '-s', '--format=%cI', revisions.head], 'git show could not read the committer date of HEAD.').slice(0, 10),
  };
}
