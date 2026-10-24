import { spawnSync } from 'node:child_process';
import { isJsonObject } from '../code-quality/shared/json.ts';
import { CommandError, git } from '../code-quality/shared/repository.ts';
import type { Revisions } from './git-reads.ts';
import { inStage, networkLimitMs, outputOf, recordOf, type Workspace } from './replay-workspace.ts';

const viewFields = 'mergeCommit,headRefOid,state,baseRefName,title';

export type Target =
  | { readonly kind: 'pull-request'; readonly number: number }
  | { readonly kind: 'pair'; readonly base: string; readonly head: string };

interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly state: string;
}

// The commits that a target names. baseRef is the base as the replay chose it, and base is its commit. notes tell how
// the replay chose the commits, where that is not the plain case.
export interface Revision extends Revisions {
  readonly pullRequest?: PullRequest;
  readonly baseRef: string;
  readonly base: string;
  readonly notes: readonly string[];
}

// The fields of gh pr view that the replay reads. Only a merged pull request has a merge commit.
interface View extends PullRequest {
  readonly headRefOid: string;
  readonly baseRefName: string;
  readonly mergeCommit?: string;
}

interface Choice {
  readonly baseRef: string;
  readonly head: string;
  readonly notes: readonly string[];
}

// The label of the report row, and the file of its check result.
export function namesOf(target: Target): { readonly label: string; readonly file: string } {
  if (target.kind === 'pull-request') return { label: String(target.number), file: `check-${target.number}.json` };
  const fileNamePart = (ref: string) => ref.replace(/[^\w.-]/gu, '_');
  return { label: `${target.base}:${target.head}`, file: `check-${fileNamePart(target.base)}-${fileNamePart(target.head)}.json` };
}

// --pr needs gh. Without it, the run stops before it makes a worktree.
export function checkGh(): void {
  const run = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (run.error !== undefined || run.status !== 0) throw new CommandError('--pr needs gh, and gh --version did not run. Install gh and log in, or give --pair.');
}

export function revisionOf(workspace: Workspace, target: Target, repository: string): Promise<Revision> {
  return inStage('resolve', () => (target.kind === 'pair' ? pairRevision(workspace.root, target) : pullRequestRevision(workspace, target.number, repository)));
}

async function pullRequestRevision(workspace: Workspace, number: number, repository: string): Promise<Revision> {
  const run = await workspace.run('gh', ['pr', 'view', String(number), '--repo', repository, '--json', viewFields], { cwd: workspace.root, limitMs: networkLimitMs });
  const view = viewOf(number, outputOf(run, 'gh pr view'));
  const choice = view.mergeCommit === undefined ? await openChoice(workspace, view) : await mergedChoice(workspace, view, view.mergeCommit);
  const base = commitOf(workspace.root, choice.baseRef);
  return { pullRequest: { number, title: view.title, state: view.state }, ...choice, base, mergeBase: mergeBaseOf(workspace.root, base, choice.head) };
}

// gh reads a remote service, so the replay checks each field before git gets it.
function viewOf(number: number, text: string): View {
  const value = recordOf(text, 'The output of gh pr view');
  const { title, state, headRefOid, baseRefName } = value;
  if (typeof title !== 'string' || typeof state !== 'string' || !isSha(headRefOid) || !isBranch(baseRefName)) {
    throw new CommandError(`gh pr view gave no valid title, state, head, or base branch for pull request ${number}.`);
  }
  return { number, title, state, headRefOid, baseRefName, mergeCommit: mergeCommitOf(number, state, value.mergeCommit) };
}

function mergeCommitOf(number: number, state: string, field: unknown): string | undefined {
  if (state !== 'MERGED') return undefined;
  const merge = isJsonObject(field) ? field.oid : undefined;
  if (!isSha(merge)) throw new CommandError(`gh pr view gave no merge commit for the merged pull request ${number}.`);
  return merge;
}

// GitHub merges with a merge commit, whose second parent is the head, or with one new commit on the base branch (a
// squash merge), whose parent is the base.
async function mergedChoice(workspace: Workspace, view: View, merge: string): Promise<Choice> {
  const missing = `The merge commit ${merge} of pull request ${view.number} is not in this repository. Run git fetch origin.`;
  const parents = git(workspace.root, ['rev-list', '--parents', '--max-count=1', merge], missing).trim().split(' ').slice(1);
  if (parents.length === 0) throw new CommandError(`The merge commit ${merge} of pull request ${view.number} has no parent.`);
  if (parents.length > 1) {
    const notes = parents[1] === view.headRefOid ? [] : [`The second parent ${parents[1]} of the merge commit is not headRefOid ${view.headRefOid}; the replay uses the second parent.`];
    return { baseRef: parents[0], head: parents[1], notes };
  }
  const head = await presentHead(workspace, view);
  return { baseRef: parents[0], head, notes: [`The merge commit ${merge} has one parent (a squash merge), so the head is headRefOid and the base is that parent.`] };
}

// After a squash merge, no branch may hold the head any more. Then the replay fetches the head ref of the pull request.
async function presentHead(workspace: Workspace, view: View): Promise<string> {
  const source = `refs/pull/${view.number}/head`;
  if (!isCommit(workspace.root, view.headRefOid)) await workspace.fetchRef(source, `pr-${view.number}`);
  if (!isCommit(workspace.root, view.headRefOid)) throw new CommandError(`The head ${view.headRefOid} of pull request ${view.number} is not in this repository, also after git fetch origin ${source}.`);
  return view.headRefOid;
}

async function openChoice(workspace: Workspace, view: View): Promise<Choice> {
  const source = `refs/pull/${view.number}/head`;
  const head = await workspace.fetchRef(source, `pr-${view.number}`);
  const base = await baseBranchOf(workspace, view.baseRefName);
  const notes = [
    ...(view.state === 'OPEN' ? [] : [`The pull request is ${view.state.toLowerCase()} without a merge, so the replay takes it as open.`]),
    ...(head === view.headRefOid ? [] : [`${source} is ${head}, not headRefOid ${view.headRefOid}; the replay uses ${source}.`]),
    ...base.notes,
  ];
  return { baseRef: base.ref, head, notes };
}

// The base branch of a stacked pull request can be gone after the merge of its parent. The replay then takes origin/main.
async function baseBranchOf(workspace: Workspace, branch: string): Promise<{ readonly ref: string; readonly notes: readonly string[] }> {
  const run = await workspace.run('git', ['fetch', '--quiet', '--no-tags', 'origin', `refs/heads/${branch}`], { cwd: workspace.root, limitMs: networkLimitMs });
  try {
    outputOf(run, `git fetch origin ${branch}`);
    return { ref: `origin/${branch}`, notes: [] };
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    return { ref: 'origin/main', notes: [`The base is origin/main, because ${error.message}`] };
  }
}

function pairRevision(root: string, target: { readonly base: string; readonly head: string }): Revision {
  const base = commitOf(root, target.base);
  const head = commitOf(root, target.head);
  return { baseRef: target.base, base, head, mergeBase: mergeBaseOf(root, base, head), notes: [] };
}

function commitOf(root: string, ref: string): string {
  return git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], `The ref ${ref} is not a commit in this repository.`).trim();
}

function mergeBaseOf(root: string, base: string, head: string): string {
  return git(root, ['merge-base', base, head], `The commits ${base} and ${head} have no common commit.`).trim();
}

function isCommit(root: string, sha: string): boolean {
  try {
    git(root, ['cat-file', '-e', `${sha}^{commit}`], `The commit ${sha} is not in this repository.`);
    return true;
  } catch {
    return false;
  }
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
}

// A branch name that git cannot take as an option or as a refspec.
function isBranch(value: unknown): value is string {
  return typeof value === 'string' && /^\w[\w./-]*$/u.test(value);
}
