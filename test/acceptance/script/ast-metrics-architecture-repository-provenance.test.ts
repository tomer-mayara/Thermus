import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { astMetricsArchitectureScript, astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { repositoryProvenanceMarkdown } from './fixtures/ast-metrics-provenance-goldens.ts';
import { repositoryFiles, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

function repositoryOf(t: TestContext) {
  const repository = GitRepository.create(t);
  repository.commit('Add files', repositoryFiles);
  return { repository, doubles: snapshotDoublesOnPath(t) };
}

async function repositoryWithCoverage(t: TestContext) {
  const { repository, doubles } = repositoryOf(t);
  const capturedCommit = repository.git('rev-parse', 'HEAD').trim();
  const captured = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });
  assert.equal(captured.code, 0, captured.stderr);
  const file = join(repository.root, 'ast-report/snapshot.json');
  const snapshot = JSON.parse(readFileSync(file, 'utf8'));
  const provenance = { ...snapshot.provenance, status: 'verified', capturedCommit, buildFingerprint: 'c'.repeat(64), captureManifestFingerprint: 'd'.repeat(64) };
  const coverage = { version: 2, suite: 'unit', measurementVersion: 'own-characters-1', commit: capturedCommit, provenance, files: [] };
  const report = join(repository.root, 'ast-report/coverage.json');
  writeFileSync(report, JSON.stringify(coverage));
  return { repository, doubles, capturedCommit, snapshot, file, report };
}

test('Given matching default coverage at an older commit and a prose-only commit, when repository architecture renders, then it keeps bands and the original capture commit', async (t) => {
  const { repository, doubles, capturedCommit } = await repositoryWithCoverage(t);
  repository.commit('Update prose', { 'README.md': 'A prose-only change.\n' });
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'HEAD'], cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, repositoryProvenanceMarkdown(repository.git('rev-parse', 'HEAD').trim(), { commit: capturedCommit }));
});

test('Given a malformed default coverage file, when architecture explicitly skips coverage, then it ignores that file and renders structure', async (t) => {
  const { repository, doubles } = repositoryOf(t);
  mkdirSync(join(repository.root, 'ast-report'));
  writeFileSync(join(repository.root, 'ast-report/coverage.json'), 'invalid');
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'HEAD', '--no-coverage'], cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, repositoryProvenanceMarkdown(repository.git('rev-parse', 'HEAD').trim(), { notice: 'Coverage was skipped with --no-coverage: the bands are withheld.' }));
  assert.ok(!result.stdout.includes('functions ≥ 30:'));
});

test('Given coverage from another source tree, when repository architecture uses the default report, then it withholds assessments in Markdown and stderr', async (t) => {
  const { repository, doubles, capturedCommit } = await repositoryWithCoverage(t);
  writeFileSync(join(repository.root, 'src/auth/session.ts'), 'export const changed = true;\n');
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'HEAD', '--touched', ''], cwd: repository.root, env: doubles.env });
  const notice = `The coverage report is of another tree (${capturedCommit.slice(0, 8)}): the bands are withheld. Run the coverage command again when the test selection permits it.`;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, `ast-metrics-architecture: ${notice}\n`);
  assert.equal(result.stdout, repositoryProvenanceMarkdown(capturedCommit, { notice, componentTouched: true }));
  assert.ok(!result.stdout.includes('functions ≥ 30:'));
  assert.ok(!result.stdout.includes('CRAP ≥ 30 |'));
  assert.ok(!result.stdout.includes('### Functions at CRAP'));
});

test('Given a repository without a coverage report, when architecture renders, then it names missing data and succeeds with structure', async (t) => {
  const { repository, doubles } = repositoryOf(t);
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'HEAD'], cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  const notice = 'No coverage report: the bands are withheld. Run the coverage command when the test selection permits it.';
  assert.equal(result.stdout, repositoryProvenanceMarkdown(repository.git('rev-parse', 'HEAD').trim(), { notice }));
  assert.ok(result.stdout.includes('```mermaid'));
});

test('Given coverage matching the caller repository but not the supplied head snapshot, when offline architecture renders without Git, then only the supplied head controls compatibility', async (t) => {
  const { repository, file, snapshot, report, capturedCommit } = await repositoryWithCoverage(t);
  writeFileSync(file, JSON.stringify({ ...snapshot, provenance: { ...snapshot.provenance, inputsFingerprint: 'f'.repeat(64) } }));
  const args = ['--head', file, '--base-snapshot', file, '--coverage', report];
  const result = await runScript(t, astMetricsArchitectureScript, { args, cwd: repository.root, env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  const notice = `The coverage report is of another tree (${capturedCommit.slice(0, 8)}): the bands are withheld. Run the coverage command again when the test selection permits it.`;
  assert.equal(result.stderr, `ast-metrics-architecture: ${notice}\n`);
  assert.equal(result.stdout, repositoryProvenanceMarkdown(capturedCommit, { notice }, true));
  assert.ok(!result.stdout.includes('functions ≥ 30:'));
});
