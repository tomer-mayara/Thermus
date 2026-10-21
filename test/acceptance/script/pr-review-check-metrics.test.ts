import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, eligibilityOf, commitsOf, decisionNote, linesUnder, metricsOptions, processText, reviewText, tierOf, writeMetrics } from './fixtures/pr-review-check.ts';
import { guideChange, measuredFiles } from './fixtures/pr-review-rules.ts';

// The step "Metrics" of the review tier: the stage outcomes that script/code-quality/ast-metrics-process.ts writes
// with --json, and the review findings of its review stage. pr-review-check.test.ts gives the report without them.
const timeout = 30_000;
const parserChange = { 'src/alpha/parser.ts': 'export const parser = 2;\n' };
const lowMi = 'Maintainability too low: got 63 (min: 85)';
const completed = ['goal miss', 'goal miss', 'goal miss', 'passed'];

test('Given goal misses of the process and high findings on unchanged files only, when the check runs with both files, then the metrics step adds no reason and counts the findings', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Change the parser', parserChange);
  writeMetrics(repository, completed, [
    { severity: 'high', file: 'src/beta/beta.ts', message: lowMi },
    { severity: 'high', file: 'src/alpha/printer.ts', message: lowMi },
    { severity: 'medium', file: 'src/alpha/parser.ts', message: 'Too many Lines of code (198 > 150)' },
  ]);

  const result = await checkOn(t, repository, ...metricsOptions);

  assert.equal(result.stderr, '');
  assert.equal(tierOf(result.stdout), 'T0');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- none']);
  assert.deepEqual(linesUnder(result.stdout, 'Metrics'), [
    '- Delta: goal miss', '- Review: goal miss', '- CRAP: goal miss', '- Architecture: passed',
    '- 2 findings on unchanged files, reason unchanged by this PR',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Notes'), [decisionNote]);
  assert.equal(result.code, 0);
});

test('Given a high finding on a changed production file, when the check runs with both files, then the route is T1 Team review with the file and the message, and a finding on a changed test file is no reason', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Change the parser and its fixture', { ...parserChange, 'test/alpha/fixture.ts': 'export const fixture = 1;\n' });
  writeMetrics(repository, completed, [
    { severity: 'high', file: 'src/alpha/parser.ts', message: lowMi },
    { severity: 'low', file: 'src/alpha/parser.ts', message: 'Efferent coupling too high: got 11 (max: 10)' },
    { severity: 'high', file: 'test/alpha/fixture.ts', message: 'Maintainability index: 57 -> 52 (below 85 is hard to maintain)' },
    { severity: 'high', file: 'src/beta/beta.ts', message: lowMi },
  ]);

  const result = await checkOn(t, repository, ...metricsOptions);

  assert.equal(result.stderr, '');
  assert.equal(tierOf(result.stdout), 'T1');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    `- T1 Team review ratchet.review_findings: src/alpha/parser.ts: ${lowMi}`,
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Metrics').slice(4), [
    '- outside scopes.production: test/alpha/fixture.ts: Maintainability index: 57 -> 52 (below 85 is hard to maintain)',
    '- 1 finding on unchanged files, reason unchanged by this PR',
  ]);
  assert.equal(result.code, 0);
});

test('Given a process file with the Delta stage failed and no review file, when the check runs with both options, then merge is blocked with each stage that did not complete', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Change the guide', guideChange);
  writeMetrics(repository, ['failed', 'unavailable', 'unavailable', 'unavailable']);

  const result = await checkOn(t, repository, ...metricsOptions);

  assert.equal(result.stderr, '');
  assert.equal(eligibilityOf(result.stdout), 'blocked');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- blocked required_checks: Delta failed',
    '- blocked required_checks: Review unavailable',
    '- blocked required_checks: CRAP unavailable',
    '- blocked required_checks: Architecture unavailable',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Metrics'), [
    '- Delta: failed', '- Review: unavailable', '- CRAP: unavailable', '- Architecture: unavailable',
    '- findings not read: the Review stage did not complete',
  ]);
  assert.equal(result.code, 0);
});

for (const [name, file, write, diagnostic] of [
  ['process file', 'ast-report/process.json', (commits: { base: string; head: string }) => processText({ base: commits.base, head: commits.base }, completed),
    'Run the metrics process with --json again after the last commit.'],
  ['review file', 'ast-report/review.json', (commits: { base: string; head: string }) => reviewText({ base: commits.base, head: commits.base }, []),
    'Run the metrics process again after the last commit.'],
] as const) {
  test(`Given a ${name} of another commit, when the check runs, then it exits 1 and names the file and both commits`, { timeout }, async (t) => {
    const repository = GitRepository.onFeatureBranch(t, measuredFiles());
    repository.commit('Change the parser', parserChange);
    writeMetrics(repository, completed, []);
    const { base, head } = commitsOf(repository);
    repository.write({ [file]: write({ base, head }) });

    const result = await checkOn(t, repository, ...metricsOptions);

    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `pr-review-check: The ${name} ${file} is of commit ${base}, but the candidate is ${head}. ${diagnostic}\n`);
    assert.equal(result.code, 1);
  });
}

for (const [name, write, diagnostic] of [
  ['without the process file', () => undefined, 'Cannot read the process file ast-report/process.json.'],
  ['with three stages in the process file', (repository: GitRepository) => repository.write({ 'ast-report/process.json': processText(commitsOf(repository), ['passed', 'passed', 'passed']) }),
    'The process file ast-report/process.json has no valid key outcomes: give the four stages Delta, Review, CRAP, and Architecture in order.'],
  ['with a review finding of another severity', (repository: GitRepository) => writeMetrics(repository, completed, [{ severity: 'critical', file: 'src/alpha/parser.ts', message: lowMi }]),
    'The review file ast-report/review.json has no valid key regressions[0].severity: give high, medium, or low.'],
] as const) {
  test(`Given metrics files ${name}, when the check runs, then it exits 1 and names the file`, { timeout }, async (t) => {
    const repository = GitRepository.onFeatureBranch(t, measuredFiles());
    repository.commit('Change the parser', parserChange);
    write(repository);

    const result = await checkOn(t, repository, ...metricsOptions);

    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `pr-review-check: ${diagnostic}\n`);
    assert.equal(result.code, 1);
  });
}
