import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { astMetricsReviewScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const live = { timeout: 30_000, skip: installed ? false : 'ast-metrics is not on PATH' };

interface Finding {
  readonly rule: string;
  readonly severity: string;
  readonly file: string;
  readonly subject?: string;
  readonly after: number;
}

function rulesRepository(t: TestContext, rules: string): GitRepository {
  return GitRepository.onFeatureBranch(t, {
    '.ast-metrics.yaml': `sources:\n  - ./src\nrequirements:\n  rules:\n${rules}`,
    '.ast-metrics-baseline.yaml': 'ignored: []\n',
    'src/html-cleaner-pipeline/source.ts': 'export const source = 1;\n',
    'src/mcp/target.ts': 'export const target = 1;\n',
    'src/shared/target.ts': 'export const target = 2;\n',
    'src/shared/permitted.ts': 'export const permitted = 3;\n',
  });
}

async function review(t: TestContext, repository: GitRepository): Promise<{ readonly code: number | null; readonly stderr: string; readonly findings: readonly Finding[] }> {
  const result = await runScript(t, astMetricsReviewScript, { cwd: repository.root, args: ['--base', 'main'] });
  if (result.code === 0) assert.equal(result.stderr, '', result.stderr);
  const published = JSON.parse(readFileSync(join(repository.root, 'ast-report/review.json'), 'utf8'));
  const report = published.nativeReview ?? published;
  assert.equal(report.methodologyVersion, '1.1');
  return { code: report.gate === 'passed' ? 0 : 1, stderr: result.stderr, findings: report.regressions };
}

function forbiddenRule(to: string): string {
  return `    architecture:\n      coupling:\n        forbidden:\n          - from: /src/html-cleaner-pipeline/\n            to: '${to}'\n`;
}

test('Given a target-path coupling rule, when a TypeScript named import crosses that path, then the pinned tool reports no coupling finding', live, async (t) => {
  const repository = rulesRepository(t, forbiddenRule('/src/mcp/'));
  repository.commit('Add the dependency', {
    'src/html-cleaner-pipeline/source.ts': "import { target } from '../mcp/target.ts';\nexport const source = target;\n",
  });

  const result = await review(t, repository);

  assert.equal(result.code, 0);
  assert.deepEqual(result.findings, []);
});

test('Given a symbol coupling rule, when a new TypeScript import aliases that symbol, then the pinned tool reports a low finding and permits the high gate', live, async (t) => {
  const repository = rulesRepository(t, forbiddenRule('^target$'));
  repository.commit('Add an aliased dependency', {
    'src/html-cleaner-pipeline/source.ts': "import { target as local } from '../mcp/target.ts';\nexport const source = local;\n",
  });

  const result = await review(t, repository);

  assert.equal(result.code, 0);
  assert.deepEqual(result.findings.map(({ rule, severity, file }) => ({ rule, severity, file })), [
    { rule: 'new-violation:coupling', severity: 'low', file: 'src/html-cleaner-pipeline/source.ts' },
  ]);
});

test('Given a symbol coupling rule, when the same symbol comes from another path, then it still matches while another symbol is permitted', live, async (t) => {
  const repository = rulesRepository(t, forbiddenRule('^target$'));
  repository.commit('Add imports from shared code', {
    'src/html-cleaner-pipeline/source.ts': "import { target } from '../shared/target.ts';\nexport const source = target;\n",
    'src/html-cleaner-pipeline/permitted.ts': "import { permitted } from '../shared/permitted.ts';\nexport const source = permitted;\n",
    'src/allowed.ts': "import { target } from './mcp/target.ts';\nexport const source = target;\n",
  });

  const result = await review(t, repository);

  assert.equal(result.code, 0);
  assert.deepEqual(result.findings.map(({ rule, file }) => ({ rule, file })), [
    { rule: 'new-violation:coupling', file: 'src/html-cleaner-pipeline/source.ts' },
  ]);
});

function functionWithPaths(paths: number): string {
  const conditions = Array.from({ length: paths - 1 }, (_, index) => `  if (value === ${index}) return ${index};`);
  return [`export function paths${paths}(value: number): number {`, ...conditions, '  return -1;', '}'].join('\n');
}

test('Given a high file cap and new functions with nine, ten, eleven, twenty-four, and twenty-five paths, when review runs, then its fixed warnings start at ten paths and become high at twenty-five', live, async (t) => {
  const repository = rulesRepository(t, '    complexity:\n      max_cyclomatic: 100\n');
  repository.commit('Add functions at the review boundaries', Object.fromEntries(
    [9, 10, 11, 24, 25].map((paths) => [`src/paths${paths}.ts`, functionWithPaths(paths)]),
  ));

  const result = await review(t, repository);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /^Native ast-metrics review diagnostic:\n/);
  assert.match(result.stderr, /quality gate failed: 1 high, 3 medium, 0 low regression\(s\)/);
  assert.deepEqual(result.findings.map(({ rule, severity, subject, after }) => ({ rule, severity, subject, after })), [
    { rule: 'new-complex-function', severity: 'high', subject: 'paths25', after: 25 },
    { rule: 'new-complex-function', severity: 'medium', subject: 'paths10', after: 10 },
    { rule: 'new-complex-function', severity: 'medium', subject: 'paths11', after: 11 },
    { rule: 'new-complex-function', severity: 'medium', subject: 'paths24', after: 24 },
  ]);
  const published = JSON.parse(readFileSync(join(repository.root, 'ast-report/review.json'), 'utf8'));
  assert.equal(published.reviewPolicy.newFunctionPaths, '>10');
  assert.equal(published.summary.high, 1);
  assert.equal(published.summary.medium, 2);
  assert.deepEqual(published.regressions.map((finding: { subject: string }) => finding.subject), ['paths25', 'paths11', 'paths24']);
  assert.equal(published.nativeReview.summary.medium, 3);
});

test('Given the approved repository caps, when files reach 39, 40, and 41 paths and 149, 150, and 151 lines, then only 41 paths and 151 lines exceed the native limits', live, async (t) => {
  const repository = rulesRepository(t, '');
  repository.write({ '.ast-metrics.yaml': readFileSync(join(fileURLToPath(repositoryRoot), '.ast-metrics.yaml'), 'utf8') });
  repository.commit('Add files at the approved cap boundaries', Object.fromEntries([
    ...[39, 40, 41].map((paths) => [`src/file-paths${paths}.ts`, Array.from({ length: paths }, (_, index) => `export function f${index}() { return ${index}; }`).join('\n') + '\n']),
    ...[149, 150, 151].map((lines) => [`src/file-lines${lines}.ts`, Array.from({ length: lines }, (_, index) => `export const n${index} = ${index};`).join('\n') + '\n']),
  ]));

  const result = await review(t, repository);

  assert.equal(result.code, 0);
  assert.deepEqual(result.findings.map(({ rule, severity, file }) => ({ rule, severity, file })).sort((a, b) => a.file.localeCompare(b.file)), [
    { rule: 'new-violation:max_loc', severity: 'medium', file: 'src/file-lines151.ts' },
    { rule: 'new-violation:cyclomatic_complexity', severity: 'medium', file: 'src/file-paths41.ts' },
  ]);
});
