import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, linesUnder, manualNote, routeOf } from './fixtures/pr-review-check.ts';
import { betaUsesAlpha, mainFiles, rulesPath, rulesYaml } from './fixtures/pr-review-rules.ts';

// The dependency facts of the review route: the facts to declare and the declared facts. pr-review-check.test.ts
// specifies the route from the changed paths.
const timeout = 30_000;
const betaToAlpha = '{ from: beta, to: alpha, kind: runtime }';

test('Given a source change that adds a package edge that the rules file does not list, when the check runs, then the route is FIX and the report names the fact and the key that declares it', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Use alpha in beta', betaUsesAlpha);

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- FIX dependency_graph.triggers.edge_not_listed: beta -> alpha (runtime), in src/beta/uses-alpha.ts',
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Facts to declare'), [`- dependency_graph.allowed_edges: ${betaToAlpha}`]);
  assert.deepEqual(linesUnder(result.stdout, 'Declared facts'), ['- none']);
  assert.equal(result.code, 0);
});

test('Given the edge declared in a rules file that no protected group lists, when the check runs, then the route is ASK for the rules file and for the declared fact', { timeout }, async (t) => {
  const unprotected = (edges: readonly string[][]) => rulesYaml((rules) => {
    rules.protected_paths.policy.paths = ['AGENTS.md'];
    rules.dependency_graph.allowed_edges.push(...edges.map(([from, to]) => ({ from, to, kind: 'runtime' })));
  });
  const repository = GitRepository.onFeatureBranch(t, mainFiles(unprotected([])));
  repository.commit('Use alpha in beta and declare the edge', { ...betaUsesAlpha, [rulesPath]: unprotected([['beta', 'alpha']]) });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ASK');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    `- ASK protected_paths.policy: ${rulesPath}`,
    `- ASK dependency_graph.declared: dependency_graph.allowed_edges: ${betaToAlpha}`,
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Questions to answer'), ['- protected_paths.policy: Does this change what the checks enforce? Record the new rule.']);
  assert.deepEqual(linesUnder(result.stdout, 'Facts to declare'), ['- none']);
  assert.deepEqual(linesUnder(result.stdout, 'Declared facts'), [`- dependency_graph.allowed_edges: ${betaToAlpha}`]);
  assert.equal(result.code, 0);
});

test('Given a source change that adds a forbidden edge, when the check runs, then the route is FIX and no listing can declare the edge', { timeout }, async (t) => {
  const rules = rulesYaml(({ dependency_graph: graph }) => {
    graph.forbidden_edges.push({ from: 'beta', to: ['composition', 'alpha'] });
    graph.allowed_edges.push({ from: 'beta', to: 'alpha', kind: 'runtime' });
  });
  const repository = GitRepository.onFeatureBranch(t, mainFiles(rules));
  repository.commit('Use alpha in beta', betaUsesAlpha);

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- FIX dependency_graph.triggers.forbidden_edge: beta -> alpha (runtime), in src/beta/uses-alpha.ts',
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Facts to declare'), ['- none']);
  assert.equal(result.code, 0);
});

test('Given two packages that start to import each other, when the check runs, then the route is FIX for the new cycle, which no listing can declare', { timeout }, async (t) => {
  const rules = rulesYaml(({ dependency_graph: graph }) => {
    graph.allowed_edges.push({ from: 'alpha', to: 'beta', kind: 'runtime' }, { from: 'beta', to: 'alpha', kind: 'runtime' });
  });
  const repository = GitRepository.onFeatureBranch(t, mainFiles(rules));
  repository.commit('Join alpha and beta', { ...betaUsesAlpha, 'src/alpha/uses-beta.ts': "import { beta } from '../beta/beta.ts';\n\nexport const sum = beta + 1;\n" });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- FIX dependency_graph.triggers.cycle_not_listed: alpha, beta (runtime)', '- SHOW scopes.executable: 2 changed files']);
  assert.deepEqual(linesUnder(result.stdout, 'Facts to declare'), ['- none']);
  assert.equal(result.code, 0);
});

test('Given a new edge inside a known cycle that the rules file of the branch declares, when the check runs, then the known cycle grows and the route stays FIX', { timeout }, async (t) => {
  const cycleRules = (extra: readonly { from: string; to: string; kind: string }[]) => rulesYaml(({ dependency_graph: graph }) => {
    graph.packages = ['alpha', 'beta', 'gamma', 'composition'];
    graph.allowed_edges.push({ from: 'alpha', to: 'beta', kind: 'runtime' }, { from: 'beta', to: 'gamma', kind: 'runtime' }, { from: 'gamma', to: 'alpha', kind: 'runtime' }, ...extra);
    graph.known_cycles.push({ members: ['alpha', 'beta', 'gamma'], kind: 'runtime' });
  });
  const repository = GitRepository.onFeatureBranch(t, {
    ...mainFiles(cycleRules([])),
    'src/alpha/uses-beta.ts': "import { beta } from '../beta/beta.ts';\n\nexport const one = beta;\n",
    'src/beta/uses-gamma.ts': "import { gamma } from '../gamma/gamma.ts';\n\nexport const two = gamma;\n",
    'src/gamma/gamma.ts': "import { alpha } from '../alpha/alpha.ts';\n\nexport const gamma = alpha;\n",
  });
  repository.commit('Use beta in gamma and declare the edge', {
    'src/gamma/uses-beta.ts': "import { beta } from '../beta/beta.ts';\n\nexport const three = beta;\n",
    [rulesPath]: cycleRules([{ from: 'gamma', to: 'beta', kind: 'runtime' }]),
  });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- FIX dependency_graph.triggers.known_cycle_grows: gamma -> beta (runtime) inside the known cycle alpha, beta, gamma, in src/gamma/uses-beta.ts',
    `- ASK protected_paths.policy: ${rulesPath}`,
    '- ASK dependency_graph.declared: dependency_graph.allowed_edges: { from: gamma, to: beta, kind: runtime }',
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Declared facts'), ['- dependency_graph.allowed_edges: { from: gamma, to: beta, kind: runtime }']);
  assert.equal(result.code, 0);
});

test('Given a source change that imports a file of another package outside the public surface, when the check runs, then the route is FIX and the report names the surface key', { timeout }, async (t) => {
  const rules = rulesYaml(({ dependency_graph: graph }) => { graph.allowed_edges.push({ from: 'beta', to: 'alpha', kind: 'type' }); });
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(rules), 'src/alpha/inner.ts': 'export interface Inner {\n  readonly size: number;\n}\n' });
  repository.commit('Use the inner type', { 'src/beta/uses-inner.ts': "import type { Inner } from '../alpha/inner.ts';\n\nexport const empty: Inner = { size: 0 };\n" });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- FIX dependency_graph.triggers.cross_package_file_not_in_public_surface: src/alpha/inner.ts (imported by src/beta/uses-inner.ts)',
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Facts to declare'), ['- public_surface.between_packages.alpha: src/alpha/inner.ts']);
  assert.equal(result.code, 0);
});

test('Given a changed file with a missing import and a stylesheet import, and an unchanged file with a missing import, when the check runs, then the first is FIX, the stylesheet is no fact, and the last is a note', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, {
    ...mainFiles(), 'src/beta/old.ts': "import { gone } from './gone.ts';\n\nexport const old = gone;\n", 'src/beta/page.css': 'body {}\n',
  });
  repository.commit('Add a page', { 'src/beta/page.ts': "import './page.css';\nimport { lost } from './lost.ts';\nimport { lost as again } from './lost.ts';\n\nexport const page = [lost, again];\n" });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- FIX dependency_graph.counting.unresolved_relative_import: src/beta/page.ts: ./lost.ts',
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Notes'), ['- Unresolved import in an unchanged file: src/beta/old.ts: ./gone.ts', manualNote]);
  assert.equal(result.code, 0);
});

test('Given a changed JavaScript file under src, when the check runs, then the route is FIX because the check reads TypeScript only', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Add a script', { 'src/beta/legacy.js': "import { alpha } from '../alpha/alpha.js';\nexport const legacy = alpha;\n" });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- FIX dependency_graph.counting.unresolved_relative_import: src/beta/legacy.js: the check reads TypeScript only',
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.equal(result.code, 0);
});
