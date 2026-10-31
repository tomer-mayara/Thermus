import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { JsonObject } from '../code-quality/shared/json.ts';
import { CommandError, git } from '../code-quality/shared/repository.ts';
import { blobsAt } from './blobs.ts';
import type { Revisions } from './git-reads.ts';
import { inStage, outputOf, recordOf, type Workspace } from './replay-workspace.ts';
import { rulesOf } from './rules.ts';
import type { CheckResult } from './types.ts';

const rulesPath = 'docs/implementation/pr-review-rules.yaml';
const surfaceConfigPath = 'tsconfig.api-surface.json';
const impactPath = '.pr-impact.json';
const snapshotCommand = 'script/pr-review/api-surface.ts';
const checkCommand = 'script/pr-review/check.ts';
const skippedLine = 'api-surface: skipped ';
const stepLimitMs = 600_000;

// What each commit of the replay gets from the root. The files are read once, so that all commits of a run have the
// same rules, also when the working tree changes during the run. rulesHead is HEAD of the root; uncommitted tells that
// the working tree, whose rules and checker the replay uses, differs from HEAD. snapshots is the folder that
// public_surface.snapshots of the rules names.
export interface Installation {
  readonly rulesHead: string;
  readonly uncommitted: boolean;
  readonly files: ReadonlyMap<string, Buffer>;
  readonly snapshots: string;
}

interface Evaluation {
  readonly baseCommit: string;
  readonly headCommit: string;
  readonly result: CheckResult;
  readonly notes: readonly string[];
}

interface Side {
  readonly folder: string;
  readonly parents: readonly string[];
  readonly name: 'merge base' | 'head';
}

interface Installed {
  readonly commit: string;
  readonly notes: readonly string[];
}

interface Declaration {
  readonly value?: JsonObject;
  readonly notes: readonly string[];
}

export function installationOf(root: string): Installation {
  const missing = [rulesPath, surfaceConfigPath, snapshotCommand, checkCommand, 'node_modules'].filter((path) => !existsSync(join(root, path)));
  if (missing.length > 0) throw new CommandError(`The replay needs ${missing.join(', ')} in the repository root.`);
  const rules = readFileSync(join(root, rulesPath));
  const where = `The rules file ${rulesPath} of the working tree`;
  const snapshots = rulesOf(rules.toString('utf8'), where).surface.snapshots;
  if (snapshots === undefined) throw new CommandError(`${where} has no key public_surface.snapshots, so the snapshots have no folder.`);
  return {
    rulesHead: git(root, ['rev-parse', '--verify', 'HEAD^{commit}'], 'HEAD does not name a commit.').trim(),
    uncommitted: git(root, ['status', '--porcelain', '--untracked-files=normal'], 'git status failed.').trim() !== '',
    files: new Map([[rulesPath, rules], [surfaceConfigPath, readFileSync(join(root, surfaceConfigPath))]]),
    snapshots,
  };
}

// The base commit is the merge base with the files of the root and with its snapshots made again. The head commit is
// the head with the same files. Its second parent is the base commit, so that git merge-base gives the base commit and
// the check reads the rules under test as the trusted policy; with the head as its only parent, the merge base would
// stay the earlier commit. Each commit keeps the committer date of its first parent, because the check takes the date
// of HEAD as today for the expiry of exceptions.
export async function evaluationOf(workspace: Workspace, installation: Installation, revisions: Revisions): Promise<Evaluation> {
  const prepared = await inStage('install', () => ({ hidden: hiddenChangeNotes(workspace.root, installation, revisions), declaration: declarationOf(workspace.root, revisions.head) }));
  const base = await workspace.inWorktree(revisions.mergeBase, (folder) => installedCommit(workspace, installation, { folder, parents: [revisions.mergeBase], name: 'merge base' }));
  return workspace.inWorktree(revisions.head, async (folder) => {
    const head = await installedCommit(workspace, installation, { folder, parents: [revisions.head, base.commit], name: 'head' });
    const impact = impactFileOf(workspace, prepared.declaration, { base: base.commit, head: head.commit });
    const result = await inStage('check', () => checkIn(workspace, folder, { baseCommit: base.commit, impact }));
    const notes = [...prepared.hidden, ...prepared.declaration.notes, ...base.notes, ...head.notes, ...topologyNotes(result, base.commit, head.commit)];
    return { baseCommit: base.commit, headCommit: head.commit, result, notes };
  });
}

async function installedCommit(workspace: Workspace, installation: Installation, side: Side): Promise<Installed> {
  for (const [path, contents] of installation.files) {
    mkdirSync(dirname(join(side.folder, path)), { recursive: true });
    writeFileSync(join(side.folder, path), contents);
  }
  const notes = await inStage('snapshots', () => regenerate(workspace, installation.snapshots, side), side.name);
  return { commit: await inStage('install', () => committed(workspace, installation, side), side.name), notes };
}

// The snapshot command deletes the orphan snapshots itself, so the folder holds the snapshots of the rules under test.
// With --skip-missing, a module that the rules list but that does not exist at the commit gets no snapshot there, and
// the command names it on stderr.
async function regenerate(workspace: Workspace, snapshots: string, side: Side): Promise<string[]> {
  const run = await workspace.run(process.execPath, [join(workspace.root, snapshotCommand), '--skip-missing'], { cwd: side.folder, limitMs: stepLimitMs });
  outputOf(run, 'The snapshot command');
  if (!existsSync(join(side.folder, snapshots))) throw new CommandError(`The snapshot command wrote no folder ${snapshots}.`);
  return run.stderr.split('\n').filter((line) => line.startsWith(skippedLine)).map((line) => `At the ${side.name}, the snapshot command ${line.slice('api-surface: '.length)}.`);
}

// The commit gets no ref, so it is unreachable after the removal of its worktree.
async function committed(workspace: Workspace, installation: Installation, side: Side): Promise<string> {
  const { folder, parents } = side;
  git(folder, ['add', '--all', '--', ...installation.files.keys(), installation.snapshots], 'git add failed for the installed files.');
  const tree = git(folder, ['write-tree'], 'git write-tree failed.').trim();
  const date = git(folder, ['show', '--no-patch', '--format=%cI', parents[0]], `git show could not read the committer date of ${parents[0]}.`).trim();
  const identity = { GIT_AUTHOR_NAME: 'replay', GIT_AUTHOR_EMAIL: 'replay@local', GIT_COMMITTER_NAME: 'replay', GIT_COMMITTER_EMAIL: 'replay@local', GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  const args = ['commit-tree', '--no-gpg-sign', tree, ...parents.flatMap((parent) => ['-p', parent]), '-m', `replay: install the rules of ${installation.rulesHead}`];
  const commit = outputOf(await workspace.run('git', args, { cwd: folder, limitMs: stepLimitMs, env: identity }), 'git commit-tree').trim();
  git(folder, ['reset', '--quiet', '--soft', commit], `git reset could not move HEAD to ${commit}.`);
  requireClean(folder);
  return commit;
}

// The check refuses a dirty tree. Another output of the snapshot command would also be no part of the commit.
function requireClean(folder: string): void {
  const changes = git(folder, ['status', '--porcelain', '--untracked-files=normal'], 'git status failed.').split('\n').filter(Boolean);
  if (changes.length > 0) throw new CommandError(`The worktree has other changes: ${changes.slice(0, 3).join(', ')}${changes.length > 3 ? ', and more' : ''}.`);
}

// Without a JSON object in the file at the head, the check runs without --impact, as for a candidate without a
// declaration.
function declarationOf(root: string, head: string): Declaration {
  const text = blobsAt(root, head, [impactPath]).get(impactPath);
  if (text === undefined) return { notes: [`The head has no ${impactPath}, so the check ran without --impact.`] };
  try {
    return { value: recordOf(text, `The ${impactPath} of the head`), notes: [] };
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    return { notes: [`${error.message} The check ran without --impact.`] };
  }
}

// The copy names the two commits of the replay, as the README of the check tells the author to stamp the declaration.
function impactFileOf(workspace: Workspace, declaration: Declaration, commits: { readonly base: string; readonly head: string }): string | undefined {
  if (declaration.value === undefined) return undefined;
  return workspace.temporaryFile(`impact-${commits.head}.json`, `${JSON.stringify({ ...declaration.value, ...commits }, null, 2)}\n`);
}

async function checkIn(workspace: Workspace, folder: string, inputs: { readonly baseCommit: string; readonly impact?: string }): Promise<CheckResult> {
  const impact = inputs.impact === undefined ? [] : ['--impact', inputs.impact];
  const run = await workspace.run(process.execPath, [join(workspace.root, checkCommand), '--base', inputs.baseCommit, '--json', ...impact], { cwd: folder, limitMs: stepLimitMs });
  const value = recordOf(outputOf(run, 'The check'), 'The output of the check');
  const complete = ['T0', 'T1', 'T2'].includes(String(value.tier)) && typeof value.tierName === 'string' && Array.isArray(value.reasons) && Array.isArray(value.blockers);
  if (!complete) throw new CommandError('The check printed JSON without tier, tierName, reasons, and blockers.');
  return value as unknown as CheckResult;
}

// Both commits get the same installed files, so the check does not see a change of the pull request to them.
function hiddenChangeNotes(root: string, installation: Installation, revisions: Revisions): string[] {
  const paths = git(root, ['diff', '--name-only', '--no-renames', revisions.mergeBase, revisions.head, '--', ...installation.files.keys(), installation.snapshots], 'git diff could not list the changes to the installed files.').split('\n').filter(Boolean);
  if (paths.length === 0) return [];
  const named = paths.length > 3 ? `${paths.slice(0, 3).join(', ')}, and ${paths.length - 3} more` : paths.join(', ');
  return [`The pull request changes ${named}. Both commits get the installed files, so the check does not see that change.`];
}

// Another merge base or candidate shows that the check did not compare the two commits of the replay.
function topologyNotes(result: CheckResult, baseCommit: string, headCommit: string): string[] {
  return [
    ...(result.mergeBase === baseCommit ? [] : [`The check used the merge base ${result.mergeBase}, not the base commit ${baseCommit}.`]),
    ...(result.candidate === headCommit ? [] : [`The check read the candidate ${result.candidate}, not the head commit ${headCommit}.`]),
  ];
}
