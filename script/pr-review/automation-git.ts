import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assessmentOf } from './automation-evidence.ts';

const validationInputs = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.nvmrc'];

// The candidate is data. Only the already checked out base's checker is executed.
export function inspectCandidate(root: string, revisions: { readonly head: string; readonly base: string }, token: string) {
  const { head, base } = revisions;
  for (const sha of [head, base]) if (!/^[a-f\d]{40}$/.test(sha)) throw new Error('Expected full commit IDs.');
  const env = { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}` };
  git(root, ['fetch', '--no-tags', 'origin', head, base], { env });
  const mergeBase = git(root, ['merge-base', head, base]);
  if (mergeBase !== base) throw new Error('Update the candidate from the current default branch before automatic merge.');
  const paths = git(root, ['diff', '--no-renames', '--name-only', '-z', base, head]).split('\0').filter(Boolean);
  if (!paths.includes('.pr-impact.json')) throw new Error('Update the committed .pr-impact.json for this candidate.');
  const declaration = declarationAt(root, head);
  const changedValidation = paths.some((path) => path.startsWith('.github/workflows/') || path.startsWith('script/pr-review/automation-') || path.startsWith('.habit-hooks/') || path.startsWith('tsconfig') || validationInputs.includes(path));
  const temp = mkdtempSync(join(tmpdir(), 'thermus-merge-'));
  const checkout = join(temp, 'candidate');
  try {
    git(root, ['worktree', 'add', '--detach', checkout, head]);
    const impact = join(temp, 'impact.json');
    writeFileSync(impact, JSON.stringify({ ...declaration, head, base }));
    const result = spawnSync(process.execPath, [join(root, 'script/pr-review/check.ts'), '--base', base, '--impact', impact, '--json'], {
      cwd: checkout, env: { PATH: process.env.PATH }, encoding: 'utf8', shell: false, maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) throw new Error(`The trusted checker failed: ${result.stderr || String(result.error)}`);
    return { assessment: assessmentOf(JSON.parse(result.stdout)), paths, changedValidation };
  } finally {
    // Worktree removal does not execute candidate cleanup code.
    git(root, ['worktree', 'remove', '--force', checkout], { allowFailure: true });
    rmSync(temp, { recursive: true, force: true });
  }
}

function declarationAt(root: string, head: string): object {
  const declaration: unknown = JSON.parse(git(root, ['show', `${head}:.pr-impact.json`]));
  if (typeof declaration !== 'object' || declaration === null || Array.isArray(declaration)) throw new Error('The committed impact declaration must be an object.');
  return declaration;
}

export function trustedCommit(root: string): string {
  return git(root, ['rev-parse', 'HEAD']);
}

function git(root: string, args: readonly string[], options: { readonly env?: NodeJS.ProcessEnv; readonly allowFailure?: boolean } = {}): string {
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, env: options.env ?? { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8', shell: false, maxBuffer: 16 * 1024 * 1024 });
  if (!options.allowFailure && (result.error || result.status !== 0)) throw new Error(`Git could not ${args[0]}.`);
  return result.stdout.trimEnd();
}
