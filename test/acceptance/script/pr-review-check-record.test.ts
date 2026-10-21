import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, linesUnder, manualNote, routeOf } from './fixtures/pr-review-check.ts';
import { betaUsesAlpha, guideChange, historicalRulesYaml, mainFiles, rulesPath, rulesYaml } from './fixtures/pr-review-rules.ts';

// The candidate and the rules of the review route, and its JSON record. pr-review-check.test.ts specifies the route
// from the changed paths.
const timeout = 30_000;
const dirtyMessage = 'pr-review-check: The working tree has uncommitted changes. Commit them, or run with --allow-dirty to check HEAD alone.\n';

test('Given --json, when the check runs, then it prints one JSON object with stable keys, the commits, the route, and the reasons', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Use alpha in beta', betaUsesAlpha);

  const result = await checkOn(t, repository, '--json');

  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.deepEqual(Object.keys(report), [
    'route', 'candidate', 'mergeBase', 'reasons', 'questions', 'changedPaths', 'lineCounts', 'tests', 'mi', 'crap', 'metrics',
    'factsToDeclare', 'declaredFacts', 'surfaceDifferences', 'notes', 'label',
  ]);
  assert.equal(report.route, 'FIX');
  assert.equal(report.candidate, repository.git('rev-parse', 'HEAD').trim());
  assert.equal(report.mergeBase, repository.git('rev-parse', 'main').trim());
  assert.deepEqual(report.reasons, [
    { route: 'FIX', key: 'dependency_graph.triggers.edge_not_listed', fact: 'beta -> alpha (runtime), in src/beta/uses-alpha.ts' },
  ]);
  assert.deepEqual(report.changedPaths, [{ status: 'A', path: 'src/beta/uses-alpha.ts' }]);
  assert.deepEqual(report.factsToDeclare, [{ key: 'dependency_graph.allowed_edges', value: '{ from: beta, to: alpha, kind: runtime }' }]);
  assert.deepEqual(report.lineCounts, { production: 3, productionLimit: 400, total: 3, totalLimit: 1500 });
  assert.equal(result.code, 0);
});

test('Given an uncommitted source file and an uncommitted edit, when the check runs, then it exits 1 and asks for a commit', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Change the guide', guideChange);
  repository.write({ 'src/gamma/new.ts': 'export const gamma = 3;\n' });

  const result = await checkOn(t, repository);

  assert.equal(result.stdout, '');
  assert.equal(result.stderr, dirtyMessage);
  assert.equal(result.code, 1);
});

test('Given uncommitted changes and --allow-dirty, when the check runs, then a note says that they are not part of the candidate and they do not count', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Change the guide', guideChange);
  repository.write({ 'src/gamma/new.ts': 'export const gamma = 3;\n', 'AGENTS.md': '# Agents\n\nNot committed.\n' });

  const result = await checkOn(t, repository, '--allow-dirty');

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'SHIPPED');
  assert.deepEqual(linesUnder(result.stdout, 'Changed paths'), ['- M docs/guide.md']);
  assert.deepEqual(linesUnder(result.stdout, 'Notes'), ['- Uncommitted changes are not part of the candidate: the check reads the commit HEAD only.', manualNote]);
  assert.equal(result.code, 0);
});

test('Given a merge base without the rules file, when the check runs, then the rules file of the branch applies, a note says so, and the route is CLARIFICATION_NEEDED', { timeout }, async (t) => {
  const { [rulesPath]: rules, ...withoutRules } = mainFiles();
  const repository = GitRepository.onFeatureBranch(t, withoutRules);
  repository.commit('Add the rules file', { [rulesPath]: rules });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'CLARIFICATION_NEEDED');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [`- CLARIFICATION_NEEDED protected_paths.policy: ${rulesPath}`]);
  assert.deepEqual(linesUnder(result.stdout, 'Notes'), ['- The rules file of the merge base does not exist, so the file at HEAD applies.', manualNote]);
  assert.equal(result.code, 0);
});

test('Given a merge base with a rules file that is not valid, when the check runs, then the rules file of the branch applies, a note names the problem, and the route is CLARIFICATION_NEEDED', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles(rulesYaml((rules) => { rules.size.total_lines_read_above = -1; })));
  repository.commit('Repair the rules file', { [rulesPath]: rulesYaml() });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'CLARIFICATION_NEEDED');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [`- CLARIFICATION_NEEDED protected_paths.policy: ${rulesPath}`]);
  assert.deepEqual(linesUnder(result.stdout, 'Notes'), [
    `- The rules file of the merge base is not valid, so the file at HEAD applies. The rules file ${rulesPath} at the merge base has no valid key size.total_lines_read_above: give a whole number, 0 or more.`,
    manualNote,
  ]);
  assert.equal(result.code, 0);
});

test('Given historical routes at the merge base and relaxed current rules at HEAD, when the check runs, then base protections and thresholds still apply with current route names', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles(historicalRulesYaml()));
  repository.commit('Adopt four routes and change the guide', { [rulesPath]: rulesYaml(), ...guideChange });

  const result = await checkOn(t, repository, '--json');

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.route, 'CLARIFICATION_NEEDED');
  assert.equal(report.lineCounts.totalLimit, 1);
  assert.ok(report.reasons.some((reason: { route: string; key: string; fact: string }) => reason.route === 'CLARIFICATION_NEEDED' && reason.key === 'protected_paths.policy' && reason.fact === 'docs/guide.md'));
  assert.ok(report.reasons.some((reason: { route: string; key: string }) => reason.route === 'ARCHITECT_REVIEW_NEEDED' && reason.key === 'size.total_lines_read_above'));
  assert.deepEqual(report.notes, [manualNote.slice(2)]);
});

test('Given historical route names at HEAD, when the check runs, then the check requires the current four routes', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles(historicalRulesYaml()));
  repository.commit('Change the guide', guideChange);

  const result = await checkOn(t, repository);

  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /at HEAD has no valid key routes.order: give FIX, CLARIFICATION_NEEDED, ARCHITECT_REVIEW_NEEDED, SHIPPED/);
});
