import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const { inspectCandidate } = await import(new URL('automation-git.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/automation-git.ts');

const trustedChecker = `import { readFileSync } from 'node:fs';
const impact = JSON.parse(readFileSync(process.argv[process.argv.indexOf('--impact') + 1], 'utf8'));
process.stdout.write(JSON.stringify({ candidate: impact.head, mergeBase: impact.base, tier: 'T0', eligibility: 'eligible', blockers: [] }));
`;

test('Given a candidate that changes the checker, when the controller inspects it, then only trusted base code runs and real commits replace declared stamps', (t) => {
  const repo = GitRepository.onFeatureBranch(t, { 'package.json': '{"type":"module"}', 'script/pr-review/check.ts': trustedChecker });
  const base = repo.git('rev-parse', 'main').trim();
  repo.commit('Untrusted candidate', { 'script/pr-review/check.ts': 'throw new Error("Do not run candidate code");', '.pr-impact.json': '{"version":1,"base":"fake","head":"fake"}' });
  const head = repo.git('rev-parse', 'HEAD').trim();
  repo.git('switch', '--quiet', 'main');
  repo.git('remote', 'add', 'origin', repo.root);
  const result = inspectCandidate(repo.root, { head, base }, 'not-a-real-token');
  assert.equal(result.assessment.candidate, head);
  assert.equal(result.assessment.mergeBase, base);
});

test('Given the previous pull request impact file is unchanged, when a new candidate is inspected, then inherited evidence is refused', (t) => {
  const repo = GitRepository.onFeatureBranch(t, { '.pr-impact.json': '{"version":1}', 'README.md': 'before' });
  const base = repo.git('rev-parse', 'main').trim();
  repo.commit('Change prose', { 'README.md': 'after' });
  const head = repo.git('rev-parse', 'HEAD').trim();
  repo.git('switch', '--quiet', 'main');
  repo.git('remote', 'add', 'origin', repo.root);
  assert.throws(() => inspectCandidate(repo.root, { head, base }, 'not-a-real-token'), /Update the committed/);
});

test('Given a source file moves outside src, when checks are selected, then the old source path is retained', (t) => {
  const repo = GitRepository.onFeatureBranch(t, { 'package.json': '{"type":"module"}', 'script/pr-review/check.ts': trustedChecker, 'src/file.ts': 'export const value = 1;' });
  const base = repo.git('rev-parse', 'main').trim();
  repo.git('mv', 'src/file.ts', 'renamed.ts');
  repo.commit('Move source', { '.pr-impact.json': '{"version":1}' });
  const head = repo.git('rev-parse', 'HEAD').trim();
  repo.git('switch', '--quiet', 'main');
  repo.git('remote', 'add', 'origin', repo.root);
  const result = inspectCandidate(repo.root, { head, base }, 'not-a-real-token');
  assert.ok(result.paths.includes('src/file.ts'));
  assert.ok(result.paths.includes('renamed.ts'));
});
