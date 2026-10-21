import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, eligibilityOf, commitsOf, crapOptions, crapText, linesUnder, tierOf, writeCrap } from './fixtures/pr-review-check.ts';
import { measuredFiles, rulesYaml } from './fixtures/pr-review-rules.ts';

// The CRAP rules of check 4 on the rows that script/code-quality/ast-metrics-crap.ts writes with --json.
// pr-review-check-ratchet.test.ts specifies the MI rules, and pr-review-check-exceptions.test.ts the MI exceptions.
const timeout = 30_000;
const exceptionsPath = '.code-quality-exceptions.yaml';
const wideModule = { 'src/alpha/wide.ts': 'export function wide() { return 1; }\n' };
const wideRow = { file: 'src/alpha/wide.ts', function: 'wide', change: 'new', paths: 4 };
const parserChange = { 'src/alpha/parser.ts': 'export const parser = 2;\n' };

function exceptionsFile(expires: string): string {
  return ['exceptions:', '  - function: src/alpha/wide.ts#wide', '    metric: crap', '    bound: 20', '    reason: The parser keeps one table of rules.', `    expires: ${expires}`, ''].join('\n');
}

test('Given a new function with three paths and no coverage share, when the check runs with the CRAP file, then the CRAP section gives a pass from the bound 12 and no CRAP reason fires', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Add a small module', { 'src/alpha/small.ts': 'export function small() { return 1; }\n' });
  writeCrap(repository, [{ file: 'src/alpha/small.ts', function: 'small', change: 'new', paths: 3 }]);

  const result = await checkOn(t, repository, ...crapOptions);

  assert.equal(result.stderr, '');
  assert.equal(tierOf(result.stdout), 'T0');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- none']);
  assert.deepEqual(linesUnder(result.stdout, 'CRAP'), ['- src/alpha/small.ts: small: pass from the bound [3, 12]']);
  assert.equal(result.code, 0);
});

test('Given a new function with four paths and no coverage share, when the check runs with the CRAP file, then its range crosses 15 and merge is blocked', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Add a wide module', wideModule);
  writeCrap(repository, [wideRow]);

  const result = await checkOn(t, repository, ...crapOptions);

  assert.equal(result.stderr, '');
  assert.equal(eligibilityOf(result.stdout), 'blocked');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- blocked ratchet.crap.new_function_above: src/alpha/wide.ts: wide: [4, 20]',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'CRAP'), ['- none']);
  assert.equal(result.code, 0);
});

test('Given changed legacy functions at CRAP 29.999 and 30 from known coverage, when the check runs, then the first passes and the second is blocked', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Change the parser', parserChange);
  writeCrap(repository, [
    { file: 'src/alpha/parser.ts', function: 'tokenize', change: 'changed', paths: 5, share: 0, crap: 30 },
    { file: 'src/alpha/parser.ts', function: 'parse', change: 'changed', paths: 5, share: 0.0000133, crap: 29.999002513266692 },
  ]);

  const result = await checkOn(t, repository, ...crapOptions);

  assert.equal(result.stderr, '');
  assert.equal(eligibilityOf(result.stdout), 'blocked');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- blocked ratchet.crap.changed_legacy_function_at_or_above: src/alpha/parser.ts: tokenize: 30.0',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'CRAP'), ['- src/alpha/parser.ts: parse: 29.999002513266692']);
  assert.equal(result.code, 0);
});

test('Given an unknown function above 15, an unchanged function above 30, and a row of an unchanged file, when the check runs, then only the unknown function is blocked, with the goal of a new function', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Change the parser', parserChange);
  writeCrap(repository, [
    { file: 'src/alpha/parser.ts', function: 'legacy', change: 'unchanged', paths: 35, share: 1, crap: 35 },
    { file: 'src/alpha/parser.ts', function: '(anonymous)', change: 'unknown', paths: 4, share: 0, crap: 20 },
    { file: 'src/alpha/printer.ts', function: 'print', change: 'new', paths: 20 },
  ]);

  const result = await checkOn(t, repository, ...crapOptions);

  assert.equal(result.stderr, '');
  assert.equal(eligibilityOf(result.stdout), 'blocked');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- blocked ratchet.crap.new_function_above: src/alpha/parser.ts: (anonymous): 20.0',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'CRAP'), ['- none']);
  assert.equal(result.code, 0);
});

for (const [expires, route, reasons] of [
  ['2999-12-31', 'T1', [
    `- T1 Team review read_paths: ${exceptionsPath}`,
    '- T1 Team review ratchet.exceptions: src/alpha/wide.ts#wide: [4, 20] covered by "The parser keeps one table of rules." until 2999-12-31',
  ]],
  ['2000-01-01', 'blocked', [
    '- blocked ratchet.exceptions.expired: src/alpha/wide.ts#wide',
    '- blocked ratchet.crap.new_function_above: src/alpha/wide.ts: wide: [4, 20]',
    `- T1 Team review read_paths: ${exceptionsPath}`,
  ]],
] as const) {
  test(`Given an exception entry for the function with a bound of 20 that expires on ${expires}, when the check runs, then the route is ${route}`, { timeout }, async (t) => {
    const repository = GitRepository.onFeatureBranch(t, measuredFiles(rulesYaml((document) => { document.read_paths.paths.push(exceptionsPath); })));
    repository.commit('Add a wide module and its exception', { ...wideModule, [exceptionsPath]: exceptionsFile(expires) });
    writeCrap(repository, [wideRow]);

    const result = await checkOn(t, repository, ...crapOptions);

    assert.equal(result.stderr, '');
    assert.equal(route === 'blocked' ? eligibilityOf(result.stdout) : tierOf(result.stdout), route);
    assert.deepEqual(linesUnder(result.stdout, 'Reasons'), reasons);
    assert.equal(result.code, 0);
  });
}

test('Given a CRAP file of another commit, when the check runs, then it exits 1 and names the file and both commits', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Add a wide module', wideModule);
  const { base, head } = commitsOf(repository);
  repository.write({ 'ast-report/crap.json': crapText({ base, head: base }, []) });

  const result = await checkOn(t, repository, ...crapOptions);

  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `pr-review-check: The CRAP file ast-report/crap.json is of commit ${base}, but the candidate is ${head}. Run the CRAP command with --json again after the last commit.\n`);
  assert.equal(result.code, 1);
});

for (const [name, write, diagnostic] of [
  ['that does not exist', () => undefined, 'Cannot read the CRAP file ast-report/crap.json.'],
  ['with a row whose paths are a text', (repository: GitRepository) => repository.write({
    'ast-report/crap.json': JSON.stringify({ version: 1, base: commitsOf(repository).base, head: commitsOf(repository).head, rows: [{ ...wideRow, paths: '4' }] }),
  }), 'The CRAP file ast-report/crap.json has no valid key rows[0].paths: give a whole number, 0 or more.'],
] as const) {
  test(`Given a CRAP file ${name}, when the check runs, then it exits 1 and names the file`, { timeout }, async (t) => {
    const repository = GitRepository.onFeatureBranch(t, measuredFiles());
    repository.commit('Add a wide module', wideModule);
    write(repository);

    const result = await checkOn(t, repository, ...crapOptions);

    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `pr-review-check: ${diagnostic}\n`);
    assert.equal(result.code, 1);
  });
}
