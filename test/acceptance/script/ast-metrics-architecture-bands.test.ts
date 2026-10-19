import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript, type ScriptResult } from '../../support/processes/script-command.ts';
import { bandedBase, bandedLegend, bandedTableHead, coverageArguments, coverageNote, fn, functionsSection } from './fixtures/ast-metrics-architecture-coverage.ts';
import { bandedBaseGraph, baseEdges, baseNodes, graphDefinitions } from './fixtures/ast-metrics-architecture-goldens.ts';
import { bandsNeedTheCoverage, complexityHeading, edited, legend, noProductionFile, noTrend, snapshotArguments, tableHead, type SnapshotEdits } from './fixtures/ast-metrics-architecture-snapshots.ts';

// The CRAP bands of the architecture delta, from two snapshot files and a coverage report. With --head, --base-snapshot,
// and --coverage, the command runs neither git nor ast-metrics, so these cases run with an empty PATH. Each expected
// text is the complete output, with the trend section without a store at its end.
// fixtures/ast-metrics-architecture-coverage.ts gives the functions of the base and their
// covered shares: auth, hosted-admin, and src have functions at CRAP 30 or more, and the shared kernel has none.
const timeout = 20_000;
const noTools = { PATH: '' };

const header = '## Architecture of src/: base a1b2c3d4 → head';
const structure = 'Modularity 0.52 → 0.52 · cross share 0.26 → 0.26 · cycles 0 → 0 · communities 4 → 4';

// The node lines of the banded base, as the graph shows them when no function changed.
const bandedNodes = {
  auth: '  c_auth["auth<br/>4 files · MI 58.6 · paths 110<br/>▲ warning: 1 fn ≥ 30"]',
  hostedAdmin: '  c_hosted_admin["hosted-admin<br/>2 files · MI 66.6 · paths 75<br/>▲ warning: 2 fn ≥ 30"]',
  kernel: '  c_shared_kernel["shared kernel<br/>1 file · MI 77.0 · paths 18<br/>● good: 0 fn ≥ 30"]',
  src: '  c_src["src<br/>2 files · MI 56.0 · paths 40<br/>▲ warning: 1 fn ≥ 30"]',
};

const classDefs = {
  good: '  classDef good stroke:#0ca30c',
  warning: '  classDef warning stroke:#fab219',
  critical: '  classDef critical stroke:#d03b3b',
};

// The lines of the graph after the node lines: the edges, the class definitions in the order touched, gone, good,
// warning, critical, and the class lines in the same order.
function graph(nodes: readonly string[], bandDefs: readonly string[], classes: readonly string[]): string[] {
  return ['```mermaid', 'flowchart LR', ...nodes, ...baseEdges, ...graphDefinitions, ...bandDefs, ...classes, '```', '', bandedLegend];
}

function markdown(functions: string, picture: readonly string[], complexity: readonly string[]): string {
  return [header, '', `${structure} · functions ≥ 30: ${functions}`, '', ...picture, '', ...complexity, '', coverageNote, '', ...noTrend, ''].join('\n');
}

function bandedTable(rows: readonly string[], listed: readonly string[], unmatched = 0): string[] {
  return [complexityHeading, '', ...bandedTableHead, ...rows, '', ...functionsSection(listed, unmatched)];
}

async function runWith(t: TestContext, head: SnapshotEdits, touched: string): Promise<ScriptResult> {
  const args = [...snapshotArguments(t, bandedBase, edited(bandedBase, head)), '--touched', touched, ...coverageArguments(t)];
  return runScript(t, astMetricsArchitectureScript, { args, env: noTools });
}

test('Given equal covered snapshots, when the command runs, then it prints the unchanged-map line, every node with its assessable band and no change arrow or touched border, and the legend', { timeout }, async (t) => {
  const args = [...snapshotArguments(t, bandedBase, bandedBase), ...coverageArguments(t)];

  const result = await runScript(t, astMetricsArchitectureScript, { args, env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('4 → 4', ['The map did not change.', '', ...bandedBaseGraph], noProductionFile));
  assert.equal(result.code, 0);
});

test('Given a touched community with no function at CRAP 30 or more, when the command runs with --coverage, then its node says good with 0 functions and has the touched and the good class, each other node has its band, and the summary line counts the functions at 30 or more on each side', { timeout }, async (t) => {
  const result = await runWith(t, {}, 'src/kernel/ids.ts');

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('4 → 4', graph(Object.values(bandedNodes), [classDefs.good, classDefs.warning], [
    '  class c_shared_kernel touched',
    '  class c_shared_kernel good',
    '  class c_auth,c_hosted_admin,c_src warning',
  ]), bandedTable(['| src/kernel/ids.ts | 77.0 → 77.0 | 18 → 18 | 0 → 0 | |'], [])));
  assert.equal(result.code, 0);
});

test('Given a touched community with two functions at CRAP 30 or more in the base and none added or worse, when the command runs, then its node says warning with 2 functions, and the list of the changed files is empty', { timeout }, async (t) => {
  const result = await runWith(t, {}, 'src/hosted-admin/routes.ts');

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('4 → 4', graph(Object.values(bandedNodes), [classDefs.good, classDefs.warning], [
    '  class c_hosted_admin touched',
    '  class c_shared_kernel good',
    '  class c_auth,c_hosted_admin,c_src warning',
  ]), bandedTable(['| src/hosted-admin/routes.ts | 70.0 → 70.0 | 30 → 30 | 1 → 1 | 6 |'], [])));
  assert.equal(result.code, 0);
});

// exportAccounts has 8 decision paths and the covered share 0: CRAP 8² + 8 = 72.0.
const addedFunction = {
  communities: { 3: { paths: 83 } },
  files: { 'src/hosted-admin/accounts.ts': { paths: 53, functions: [fn('listAccounts', 12), fn('renderAccount', 3), fn('exportAccounts', 8)] } },
};

test('Given a pull request that adds a function at CRAP 30 or more to a community with two such functions, when the command runs, then the node says critical with 3 functions and the change +1, the critical class replaces the warning class, the row counts 1 → 2, and the list names the function with base new', { timeout }, async (t) => {
  const result = await runWith(t, addedFunction, 'src/hosted-admin/accounts.ts');

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('4 → 5', graph([
    bandedNodes.auth,
    '  c_hosted_admin["hosted-admin<br/>2 files · MI 66.6 · paths 83 ↑8<br/>■ critical: 3 fn ≥ 30 (+1)"]',
    bandedNodes.kernel,
    bandedNodes.src,
  ], [classDefs.good, classDefs.warning, classDefs.critical], [
    '  class c_hosted_admin touched',
    '  class c_shared_kernel good',
    '  class c_auth,c_src warning',
    '  class c_hosted_admin critical',
  ]), bandedTable(['| src/hosted-admin/accounts.ts | 63.2 → 63.2 | 45 → 53 ↑8 | 1 → 2 ↑1 | 4 |'], [
    '- `src/hosted-admin/accounts.ts` `exportAccounts`: paths 8, covered 0.00, CRAP 72.0 (base new)',
  ])));
  assert.equal(result.code, 0);
});

// verifyToken keeps the covered share 0.5. With 7 decision paths its CRAP is 49 × 0.125 + 7 = 13.1; with 14 it is
// 196 × 0.125 + 14 = 38.5.
const worseFunction = {
  communities: { 1: { paths: 117 } },
  files: { 'src/auth/tokens.ts': { paths: 37, functions: [fn('issueToken', 8), fn('verifyToken', 14)] } },
};

test('Given a pull request that raises the decision paths of a function so that its CRAP goes from below 30 to 30 or more, when the command runs, then the function is worse, its community is critical, and the list names it with its base CRAP', { timeout }, async (t) => {
  const result = await runWith(t, worseFunction, 'src/auth/tokens.ts');

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('4 → 5', graph([
    '  c_auth["auth<br/>4 files · MI 58.6 · paths 117 ↑7<br/>■ critical: 2 fn ≥ 30 (+1)"]',
    bandedNodes.hostedAdmin,
    bandedNodes.kernel,
    bandedNodes.src,
  ], [classDefs.good, classDefs.warning, classDefs.critical], [
    '  class c_auth touched',
    '  class c_shared_kernel good',
    '  class c_hosted_admin,c_src warning',
    '  class c_auth critical',
  ]), bandedTable(['| src/auth/tokens.ts | 62.4 → 62.4 | 30 → 37 ↑7 | 1 → 2 ↑1 | 5 |'], [
    '- `src/auth/tokens.ts` `verifyToken`: paths 14, covered 0.50, CRAP 38.5 (base 13.1)',
  ])));
  assert.equal(result.code, 0);
});

// refresh has 30 decision paths, so any covered share would give it a CRAP of 30 or more.
test('Given a changed file with an anonymous function and a function whose name the coverage report has twice, when the command runs, then neither function gets a CRAP, the row counts 0 → 0, and the unmatched count is 2', { timeout }, async (t) => {
  const result = await runWith(t, {}, 'src/auth/session.ts');

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('4 → 4', graph(Object.values(bandedNodes), [classDefs.good, classDefs.warning], [
    '  class c_auth touched',
    '  class c_shared_kernel good',
    '  class c_auth,c_hosted_admin,c_src warning',
  ]), bandedTable(['| src/auth/session.ts | 50.0 → 50.0 | 40 → 40 | 0 → 0 | 2 |'], [], 2)));
  assert.equal(result.code, 0);
});

// The coverage report does not have src/application.ts, so the new startServer with 5 decision paths has the CRAP
// 5² + 5 = 30.0, which is at the limit.
const addedUncovered = {
  communities: { 2: { paths: 45 } },
  files: { 'src/application.ts': { paths: 35, functions: [fn('createApplication', 6), fn('startServer', 5)] } },
};

test('Given a changed file that the coverage report does not have, when the command runs, then its functions count as uncovered with CRAP = paths² + paths, so that the new function at exactly 30.0 makes its community critical', { timeout }, async (t) => {
  const result = await runWith(t, addedUncovered, 'src/application.ts');

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('4 → 5', graph([
    bandedNodes.auth,
    bandedNodes.hostedAdmin,
    bandedNodes.kernel,
    '  c_src["src<br/>2 files · MI 56.0 · paths 45 ↑5<br/>■ critical: 2 fn ≥ 30 (+1)"]',
  ], [classDefs.good, classDefs.warning, classDefs.critical], [
    '  class c_src touched',
    '  class c_shared_kernel good',
    '  class c_auth,c_hosted_admin warning',
    '  class c_src critical',
  ]), bandedTable(['| src/application.ts | 52.0 → 52.0 | 30 → 35 ↑5 | 1 → 2 ↑1 | 1 |'], [
    '- `src/application.ts` `startServer`: paths 5, covered 0.00, CRAP 30.0 (base new)',
  ])));
  assert.equal(result.code, 0);
});

test('Given snapshot files without --coverage, when the command runs, then the line after the summary says that the bands need the coverage run, and the output has no band, no band class, no CRAP column, and no list of functions', { timeout }, async (t) => {
  const args = [...snapshotArguments(t, bandedBase, bandedBase), '--touched', 'src/kernel/ids.ts'];

  const result = await runScript(t, astMetricsArchitectureScript, { args, env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [header, '', structure, '', bandsNeedTheCoverage, '', '```mermaid', 'flowchart LR',
    ...Object.values(baseNodes),
    ...baseEdges,
    ...graphDefinitions,
    '  class c_shared_kernel touched',
    '```', '', legend, '',
    complexityHeading, '', ...tableHead, '| src/kernel/ids.ts | 77.0 → 77.0 | 18 → 18 | |', '', ...noTrend, '',
  ].join('\n'));
  assert.equal(result.code, 0);
});
