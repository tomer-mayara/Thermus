import assert from 'node:assert/strict';
import { readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { stringify } from 'yaml';
import { astMetricsCliFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsReviewScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';
import { processFixture } from './fixtures/ast-metrics-process.ts';
import { truncatedLayerReview } from './fixtures/ast-metrics-review-policy.ts';

function sourceRepository(t: TestContext): GitRepository {
  return GitRepository.onFeatureBranch(t, {
    '.ast-metrics-baseline.yaml': 'ignored: []\n',
    'src/html-cleaner-pipeline/source.ts': 'export const source = 1;\n',
    'src/website-fetcher/source.ts': 'export const source = 1;\n',
    'src/mcp/target.ts': 'export const target = 1;\nexport interface Target {}\n',
    'src/auth/target.ts': 'export const target = 1;\n',
    'src/shared.ts': 'export const shared = 1;\n',
  });
}

async function runReview(t: TestContext, repository: GitRepository, args: readonly string[] = []) {
  const fake = astMetricsCliFakeOnPath(t);
  const result = await runScript(t, astMetricsReviewScript, { cwd: repository.root, args: ['--base', 'main', ...args], env: fake.env });
  return { ...result, report: JSON.parse(readFileSync(join(repository.root, 'ast-report/review.json'), 'utf8')) };
}

test('Given new forbidden imports in both approved components, when review runs, then resolved source-to-target pairs are high findings and both reports agree', async (t) => {
  const repository = sourceRepository(t);
  repository.write({
    'src/html-cleaner-pipeline/source.ts': "import { target as allowedName } from '../mcp/target.js';\nexport const source = allowedName;\n",
    'src/website-fetcher/source.ts': "export { target } from '../auth/target.ts';\n",
    'src/html-cleaner-pipeline/allowed.ts': "import { shared } from '../shared.ts';\nexport const source = shared;\n",
  });

  const result = await runReview(t, repository, ['--max-findings', '1']);

  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.report.summary.high, 2);
  assert.equal(result.report.gate, 'failed');
  assert.deepEqual(result.report.regressions.map((finding: { file: string; target: string }) => [finding.file, finding.target]), [
    ['src/html-cleaner-pipeline/source.ts', 'src/mcp/target.ts'],
    ['src/website-fetcher/source.ts', 'src/auth/target.ts'],
  ]);
  assert.match(result.stdout, /Thermus review policy/);
  assert.equal(result.stdout, truncatedLayerReview);
  assert.match(result.stdout, /src\/html-cleaner-pipeline\/source.ts.*src\/mcp\/target.ts/);
  assert.doesNotMatch(result.stdout, /src\/website-fetcher\/source.ts.*src\/auth\/target.ts/);
  assert.equal(readFileSync(join(repository.root, 'ast-report/review.md'), 'utf8'), result.stdout);
});

for (const target of ['identity', 'workos', 'web', 'cli']) {
  test(`Given nested component roots and a website-fetcher import of ${target}, when review runs, then the high-severity layer guard remains active`, async (t) => {
    const components = { 'website-fetcher': { roots: ['src/pipelines/providers/website-fetcher/'] }, [target]: { roots: [`src/group/${target}/`] } };
    const repository = GitRepository.onFeatureBranch(t, {
      '.ast-metrics-baseline.yaml': 'ignored: []\n',
      'docs/implementation/pr-review-rules.yaml': stringify({ dependency_graph: { components } }),
      'src/pipelines/providers/website-fetcher/source.ts': 'export const source = 1;\n',
      [`src/group/${target}/target.ts`]: 'export const target = 1;\n',
    });
    repository.write({ 'src/pipelines/providers/website-fetcher/source.ts': `export { target } from '../../../group/${target}/target.ts';\n` });
    const result = await runReview(t, repository);
    assert.equal(result.code, 1, result.stderr);
    assert.equal(result.report.summary.high, 1);
    assert.equal(result.report.regressions[0].target, `src/group/${target}/target.ts`);
  });
}

test('Given HTML and MCP nested roots, when a literal dynamic import crosses the boundary, then the high-severity layer guard remains active', async (t) => {
  const components = { 'html-processing': { roots: ['src/pipelines/html-processing/'] }, mcp: { roots: ['src/interfaces/mcp/'] } };
  const repository = GitRepository.onFeatureBranch(t, {
    '.ast-metrics-baseline.yaml': 'ignored: []\n',
    'docs/implementation/pr-review-rules.yaml': stringify({ dependency_graph: { components } }),
    'src/pipelines/html-processing/source.ts': 'export const source = 1;\n',
    'src/interfaces/mcp/target.ts': 'export const target = 1;\n',
  });
  repository.write({ 'src/pipelines/html-processing/source.ts': "export const source = import('../../interfaces/mcp/target.ts');\n" });
  const result = await runReview(t, repository);
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.report.summary.high, 1);
});

for (const [kind, source] of [
  ['type', "import type { Target } from '../mcp/target.ts';\nexport type Source = Target;\n"],
  ['side-effect', "import '../mcp/target.ts';\n"],
  ['dynamic', "export async function source() { return import('../mcp/target.ts'); }\n"],
] as const) test(`Given a new forbidden ${kind} import, when review runs, then the wrapper reports a high dependency finding`, async (t) => {
  const repository = sourceRepository(t);
  repository.write({ 'src/html-cleaner-pipeline/source.ts': source });
  const result = await runReview(t, repository);
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.report.regressions[0].severity, 'high');
  assert.deepEqual(result.report.regressions[0].kinds, [kind]);
});

test('Given an existing forbidden pair and renamed source and target files, when imports retain that pair, then review adds no high finding', async (t) => {
  const repository = sourceRepository(t);
  repository.git('switch', '--quiet', 'main');
  const retained = Array.from({ length: 10 }, (_, index) => `export const retained${index} = ${index};`).join('\n');
  repository.commit('Existing dependency', { 'src/html-cleaner-pipeline/source.ts': `import { target } from '../mcp/target.ts';\nexport const source = target;\n${retained}\n` });
  repository.git('switch', '--quiet', 'feature');
  repository.git('reset', '--hard', 'main');
  renameSync(join(repository.root, 'src/html-cleaner-pipeline/source.ts'), join(repository.root, 'src/html-cleaner-pipeline/moved.ts'));
  renameSync(join(repository.root, 'src/mcp/target.ts'), join(repository.root, 'src/mcp/moved.ts'));
  repository.commit('Move the dependency', { 'src/html-cleaner-pipeline/moved.ts': `import { target } from '../mcp/moved.ts';\nexport const source = target;\n${retained}\n` });
  const result = await runReview(t, repository);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.report.regressions, []);
});

test('Given a target moved from an allowed component into a forbidden component, when its guarded importer follows the move, then review reports the newly forbidden pair', async (t) => {
  const repository = sourceRepository(t);
  repository.git('switch', '--quiet', 'main');
  repository.commit('Add an allowed dependency', { 'src/html-cleaner-pipeline/source.ts': "import { shared } from '../shared.ts';\nexport const source = shared;\n" });
  repository.git('switch', '--quiet', 'feature');
  repository.git('reset', '--hard', 'main');
  repository.git('mv', 'src/shared.ts', 'src/mcp/moved.ts');
  repository.write({ 'src/html-cleaner-pipeline/source.ts': "import { shared } from '../mcp/moved.ts';\nexport const source = shared;\n" });
  const result = await runReview(t, repository);
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.report.regressions[0].target, 'src/mcp/moved.ts');
});

test('Given a guarded source moved from an allowed source folder, when its unchanged import crosses the approved boundary, then review reports the newly forbidden pair', async (t) => {
  const repository = sourceRepository(t);
  repository.commit('Add an allowed source', { 'src/other/source.ts': "import { target } from '../mcp/target.ts';\nexport const source = target;\n" });
  repository.git('branch', '--force', 'main', 'HEAD');
  repository.git('mv', 'src/other/source.ts', 'src/html-cleaner-pipeline/moved.ts');
  const result = await runReview(t, repository);
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.report.regressions[0].file, 'src/html-cleaner-pipeline/moved.ts');
});

test('Given a forbidden import added only to the base branch after divergence, when the candidate adds the same pair, then comparison with the merge base still reports it as new', async (t) => {
  const repository = sourceRepository(t);
  const dependency = "import '../mcp/target.ts';\n";
  repository.git('switch', '--quiet', 'main');
  repository.commit('Advance main', { 'src/html-cleaner-pipeline/source.ts': dependency });
  repository.git('switch', '--quiet', 'feature');
  repository.write({ 'src/html-cleaner-pipeline/source.ts': dependency });
  const result = await runReview(t, repository);
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.report.summary.high, 1);
});

test('Given an unchanged uncertain guarded source and an unrelated document change, when review runs, then that old uncertainty does not block the review', async (t) => {
  const repository = sourceRepository(t);
  repository.commit('Existing unknown dynamic import', { 'src/html-cleaner-pipeline/source.ts': 'export const source = import(name);\n' });
  repository.git('branch', '--force', 'main', 'HEAD');
  repository.write({ 'README.md': '# Changed\n' });
  const result = await runReview(t, repository);
  assert.equal(result.code, 0, result.stderr);
});

test('Given an unstaged move of a guarded source with an existing forbidden import, when review runs, then its unique unchanged content proves the pair is unchanged', async (t) => {
  const repository = sourceRepository(t);
  repository.commit('Existing dependency', { 'src/html-cleaner-pipeline/source.ts': "import '../mcp/target.ts';\n" });
  repository.git('branch', '--force', 'main', 'HEAD');
  renameSync(join(repository.root, 'src/html-cleaner-pipeline/source.ts'), join(repository.root, 'src/html-cleaner-pipeline/moved.ts'));
  const result = await runReview(t, repository);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.report.regressions, []);
});

for (const source of ["import '../mcp/missing.ts';\n", 'export const invalid = ;\n', 'export const source = import(name);\n', "import '#alias';\n"]) {
  test(`Given uncertain imports in a changed guarded source ${JSON.stringify(source)}, when review runs, then it fails with an explicit dependency diagnostic`, async (t) => {
    const repository = sourceRepository(t);
    repository.write({ 'src/html-cleaner-pipeline/source.ts': source });
    const result = await runReview(t, repository);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Cannot assess layer rules.*src\/html-cleaner-pipeline\/source.ts/);
  });
}

test('Given a new forbidden import, when the composed process runs, then its Review stage and process gate fail', async (t) => {
  const { repository, run } = processFixture(t);
  repository.write({
    'src/html-cleaner-pipeline/new.ts': "import '../mcp/new.ts';\n",
    'src/mcp/new.ts': 'export const target = 1;\n',
  });
  const result = await run();
  assert.equal(result.code, 1);
  assert.match(result.stdout, /## Review\n\nStatus: goal miss\./);
  assert.match(result.stdout, /src\/html-cleaner-pipeline\/new.ts.*src\/mcp\/new.ts/);
});
