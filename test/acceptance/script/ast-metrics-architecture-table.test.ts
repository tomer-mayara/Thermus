import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript, type ScriptResult } from '../../support/processes/script-command.ts';
import { legacyImportEvidence, componentGolden, componentNodes } from './fixtures/ast-metrics-component-goldens.ts';
import { baseGraph } from './fixtures/ast-metrics-architecture-goldens.ts';
import { bandsNeedTheCoverage, baseSnapshot, complexityHeading, edited, file, noProductionFile, noTrend, snapshotArguments, tableHead, type SnapshotEdits } from './fixtures/ast-metrics-architecture-snapshots.ts';

// The complexity table of the changed src/ files, after the architecture delta of two snapshot files. The changed files
// of these cases are in no community, so the map did not change, and the table is the part that a case specifies. With
// --head and --base-snapshot, the command runs neither git nor ast-metrics, so these cases run with an empty PATH. Each
// expected text is the complete output, with the trend section without a store at its end. Without a coverage report,
// the table has no CRAP column;
// ast-metrics-architecture-bands.test.ts specifies that column. ast-metrics-architecture-base.test.ts specifies the
// changed files of a repository.
const timeout = 20_000;
const noTools = { PATH: '' };

const architecture = [
  '## Architecture of src/: base a1b2c3d4 → head',
  '',
  'Modularity 0.52 → 0.52 · cross share 0.26 → 0.26 · cycles 0 → 0 · communities 4 → 4',
  '',
  bandsNeedTheCoverage,
  '',
  'Tool versions: base ast-metrics unknown; head ast-metrics unknown.', '',
  'The map did not change.',
  '',
  ...baseGraph,
];

function markdown(complexity: readonly string[], components: readonly string[] = componentGolden()): string {
  return [...architecture, ...legacyImportEvidence, '', ...components, '', ...complexity, '', ...noTrend, ''].join('\n');
}

function table(rows: readonly string[]): string[] {
  return [complexityHeading, '', ...tableHead, ...rows];
}

async function runWith(t: TestContext, edits: SnapshotEdits, touched: readonly string[]): Promise<ScriptResult> {
  const args = [...snapshotArguments(t, baseSnapshot, edited(baseSnapshot, edits)), '--touched', touched.join(',')];
  return runScript(t, astMetricsArchitectureScript, { args, env: noTools });
}

// The base ranks application.ts and session.ts above access-context.ts by risk.
const lowerScore = { files: { 'src/auth/access-context.ts': { maintainability: 60, paths: 15 } } };

test('Given a changed file whose maintainability fell from 72.0 to 60.0 and whose decision paths rose from 12 to 15, when the command runs, then its row shows both before and after with the arrow and the size of each change, and its rank among the ten riskiest files of the head', { timeout }, async (t) => {
  const result = await runWith(t, lowerScore, ['src/auth/access-context.ts']);

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(table(['| src/auth/access-context.ts | 72.0 → 60.0 ↓12.0 | 12 → 15 ↑3 | 3 |']), componentGolden(Object.values({ ...componentNodes, auth: '  c_auth["auth<br/>5 files · MI 58.9 ↓2.4 · paths 125 ↑3"]' }), ['  class c_auth touched'])));
  assert.equal(result.code, 0);
});

const newFile = { addedFiles: [file('src/mcp/new-file.ts', null, { maintainability: 70.2, paths: 8 })] };

test('Given a new file without a risk score, when the command runs, then its row says new before each value of the head and its rank cell says gone', { timeout }, async (t) => {
  const result = await runWith(t, newFile, ['src/mcp/new-file.ts']);

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(table(['| src/mcp/new-file.ts | new → 70.2 | new → 8 | |']), componentGolden([componentNodes.auth, componentNodes.hostedAdmin, componentNodes.kernel, '  c_mcp["mcp · new<br/>1 file · MI 70.2 · paths 8"]', componentNodes.old, componentNodes.src, componentNodes.portal], ['  class c_mcp touched'])));
  assert.equal(result.code, 0);
});

const goneFile = { files: { 'src/old/gone.ts': null } };

test('Given a changed file that the head does not have, when the command runs, then its row says gone after each value of the base and its rank cell says gone', { timeout }, async (t) => {
  const result = await runWith(t, goneFile, ['src/old/gone.ts']);

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(table(['| src/old/gone.ts | 55.0 → gone | 20 → gone | gone |']), componentGolden(Object.values({ ...componentNodes, old: '  c_old["old · gone<br/>1 file · MI 55.0 · paths 20"]' }), ['  class c_old touched', '  class c_old gone'])));
  assert.equal(result.code, 0);
});

test('Given a changed file of types, which has no maintainability index in the head, when the command runs, then its row says not measured for the maintainability and for the decision paths', { timeout }, async (t) => {
  const result = await runWith(t, {}, ['src/user-portal/env.d.ts']);

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(table(['| src/user-portal/env.d.ts | not measured | not measured | |']), componentGolden(Object.values(componentNodes), ['  class c_user_portal touched'])));
  assert.equal(result.code, 0);
});

test('Given changed files of each kind, when the command runs, then the table has one row for each, sorted by path', { timeout }, async (t) => {
  const edits = { files: { ...lowerScore.files, ...goneFile.files }, addedFiles: newFile.addedFiles };

  const result = await runWith(t, edits, ['src/user-portal/env.d.ts', 'src/old/gone.ts', 'src/auth/access-context.ts', 'src/mcp/new-file.ts']);

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(table([
    '| src/auth/access-context.ts | 72.0 → 60.0 ↓12.0 | 12 → 15 ↑3 | 3 |',
    '| src/mcp/new-file.ts | new → 70.2 | new → 8 | |',
    '| src/old/gone.ts | 55.0 → gone | 20 → gone | gone |',
    '| src/user-portal/env.d.ts | not measured | not measured | |',
  ]), componentGolden(['  c_auth["auth<br/>5 files · MI 58.9 ↓2.4 · paths 125 ↑3"]', componentNodes.hostedAdmin, componentNodes.kernel, '  c_mcp["mcp · new<br/>1 file · MI 70.2 · paths 8"]', '  c_old["old · gone<br/>1 file · MI 55.0 · paths 20"]', componentNodes.src, componentNodes.portal], ['  class c_auth,c_mcp,c_old,c_user_portal touched', '  class c_old gone'])));
  assert.equal(result.code, 0);
});

test('Given changed files of which none is under src/, when the command runs, then the complexity section after the architecture delta says that no production file changed, and has no table', { timeout }, async (t) => {
  const result = await runWith(t, {}, ['test/unit/script/ast-metrics-architecture.test.ts', 'script/code-quality/ast-metrics-architecture.ts', 'README.md']);

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(noProductionFile));
  assert.equal(result.code, 0);
});
