import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { changesRepository, coverageForChanges, functionSource, headReport, newPath, oldPath } from './fixtures/ast-metrics-repository-changes-harness.ts';

const tableHeading = '## Complexity of the changed files';
const functionsHeading = '### Functions at CRAP 30 or more, added or worse';
const tableHead = ['| File | Maintainability | Decision paths | CRAP ≥ 30 | Risk rank |', '| --- | --- | --- | --- | --- |'];

test('Given a pure Git file rename and compatible head coverage, when architecture compares the working tree, then one new-path row retains equal base values and no function is falsely new', async (t) => {
  const { repository, doubles } = changesRepository(t);
  repository.git('mv', oldPath, newPath);
  repository.commit('Rename work', headReport([newPath]));
  repository.write({ 'ast-report/coverage.json': JSON.stringify(coverageForChanges(repository, newPath)) });
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout.split(tableHeading)[1].split(functionsHeading)[0], `\n\n${[...tableHead, `| ${newPath} (renamed from ${oldPath}) | 90.0 → 90.0 | 6 → 6 | 1 → 1 | 1 |`].join('\n')}\n\n`);
  assert.ok(result.stdout.includes('functions ≥ 30: 1 → 1'));
  assert.ok(result.stdout.includes(`${functionsHeading}\n\nNone.`));
  assert.ok(result.stdout.includes('Base functions without an estimated covered share: 0.'));
  assert.ok(!result.stdout.includes('Unknown function identity:'));
});

test('Given only a deleted function file, when architecture compares the working tree, then its community is touched, its row is gone, and base coverage remains unknown', async (t) => {
  const { repository, doubles } = changesRepository(t);
  repository.git('rm', '--quiet', oldPath);
  repository.commit('Delete work', headReport([]));
  repository.write({ 'ast-report/coverage.json': JSON.stringify(coverageForChanges(repository)) });
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.ok(result.stdout.includes('| src/core/old.ts | 90.0 → gone | 6 → gone | not measured → gone | gone |'));
  assert.ok(result.stdout.includes('class c_core touched'));
  assert.ok(result.stdout.includes('functions ≥ 30: 0 → 0'));
  assert.ok(result.stdout.includes('Base functions without an estimated covered share: 1.'));
});

test('Given a unique unchanged function moved to an untracked destination, when architecture compares Git deletion and addition evidence, then its covered share follows the proven function move', async (t) => {
  const { repository, doubles } = changesRepository(t);
  repository.git('rm', '--quiet', oldPath);
  repository.write({ [newPath]: functionSource, ...headReport([newPath]) });
  repository.write({ 'ast-report/coverage.json': JSON.stringify(coverageForChanges(repository, newPath)) });
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.ok(repository.git('ls-files', '--others', '--exclude-standard').includes(newPath));
  assert.ok(result.stdout.includes('functions ≥ 30: 1 → 1'));
  assert.ok(result.stdout.includes(`${functionsHeading}\n\nNone.`));
  assert.ok(result.stdout.includes('Base functions without an estimated covered share: 0.'));
  assert.ok(!result.stdout.includes('Unknown function identity:'));
  assert.ok(result.stdout.includes(`| ${newPath} | new → 90.0 | new → 6 | new → 1 | 1 |`));
});
