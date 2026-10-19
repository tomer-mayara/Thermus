import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { legacyImportEvidence, componentGolden, componentNodes } from './fixtures/ast-metrics-component-goldens.ts';
import { baseEdges, baseGraph, baseNodes, graphDefinitions } from './fixtures/ast-metrics-architecture-goldens.ts';
import { bandsNeedTheCoverage, baseSnapshot, community, complexityHeading, edge, edited, legend, noProductionFile, noTrend, snapshotArguments, tableHead } from './fixtures/ast-metrics-architecture-snapshots.ts';

// The architecture delta of two snapshot files. With --head and --base-snapshot, the command runs neither git nor
// ast-metrics, so these cases run with an empty PATH. Each expected text is the complete output, with the complexity
// section and the trend section at its end. These cases give no coverage report, so the line after the summary says
// that the bands need it, and no --trend-store, so the trend section says No trend store.
// ast-metrics-architecture-table.test.ts specifies the complexity section, ast-metrics-architecture-bands.test.ts the
// bands, ast-metrics-architecture-trend.test.ts the trend, and ast-metrics-architecture-base.test.ts the command with
// the snapshots of a repository.
const timeout = 20_000;
const noTools = { PATH: '' };

const header = '## Architecture of src/: base a1b2c3d4 → head';
const equalSummary = 'Modularity 0.52 → 0.52 · cross share 0.26 → 0.26 · cycles 0 → 0 · communities 4 → 4';

interface ReportParts { readonly complexity?: readonly string[]; readonly components?: readonly string[]; readonly movements?: readonly string[] }

function markdown(summary: string, picture: readonly string[], parts: ReportParts = {}): string {
  const { complexity = noProductionFile, components = componentGolden(), movements = [] } = parts;
  return [header, '', summary, '', bandsNeedTheCoverage, '', 'Tool versions: base ast-metrics unknown; head ast-metrics unknown.', '', ...picture, ...legacyImportEvidence, ...movements, '', ...components, '', ...complexity, '', ...noTrend, ''].join('\n');
}

// The lines of the graph between the edges and the end of the block.
function graph(lines: readonly string[], classes: readonly string[] = []): string[] {
  return ['```mermaid', 'flowchart LR', ...lines, ...graphDefinitions, ...classes, '```', '', legend];
}

test('Given two equal snapshots, when the command runs with --head and --base-snapshot, then it prints the header, the summary line with equal sides, the unchanged-map line, every node without change arrows or touched borders, the missing-coverage reason, and the legend', { timeout }, async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, baseSnapshot), env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(equalSummary, ['The map did not change.', '', ...baseGraph]));
  assert.equal(result.code, 0);
});

test('Given a head with a new dependency between two matched communities, when the command runs, then the graph shows it as a thick edge with its references and new, and the summary line shows the modularity and the cross share before and after', { timeout }, async (t) => {
  const head = edited(baseSnapshot, { global: { modularity: 0.51, crossShare: 0.27 }, communities: { 2: { edges: [edge('1', 20), edge('3', 5), edge('shared', 1)] } } });

  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, head), env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('Modularity 0.52 → 0.51 · cross share 0.26 → 0.27 · cycles 0 → 0 · communities 4 → 4', graph([
    ...Object.values(baseNodes),
    ...baseEdges,
    '  c_src == "1 · new" ==> c_shared_kernel',
  ])));
  assert.equal(result.code, 0);
});

// The dependency that closes the cycle is new too. A cycle edge is always dashed and red, so that edge says new in its
// label instead of a thick line.
test('Given a cycle in the head, when the command runs, then each edge of the cycle is dashed with cycle in its label and a red link style at its position, and the summary counts the cycle', { timeout }, async (t) => {
  const head = edited(baseSnapshot, {
    global: { modularity: 0.49, crossShare: 0.29, cycles: [['auth', 'hosted-admin']] },
    communities: { 1: { edges: [edge('3', 10, true), edge('shared', 2)] }, 3: { edges: [edge('1', 3, true), edge('shared', 4)] } },
  });

  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, head), env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('Modularity 0.52 → 0.49 · cross share 0.26 → 0.29 · cycles 0 → 1 · communities 4 → 4', graph([
    ...Object.values(baseNodes),
    '  c_auth -. "10 · cycle" .-> c_hosted_admin',
    '  c_auth -- "2" --> c_shared_kernel',
    '  c_hosted_admin -. "3 · new · cycle" .-> c_auth',
    '  c_hosted_admin -- "4" --> c_shared_kernel',
    '  c_src -- "20" --> c_auth',
    '  c_src -- "5" --> c_hosted_admin',
    '  linkStyle 0 stroke:#d03b3b,stroke-width:2px',
    '  linkStyle 2 stroke:#d03b3b,stroke-width:2px',
  ])));
  assert.equal(result.code, 0);
});

// Each head community shares 2 of the 5 files of both with the base auth, an overlap of 0.4, so neither matches it.
test('Given a base community whose files split into two head communities, each with an overlap below 0.5, when the command runs, then the graph names it gone with its base numbers and dashed grey edges, names the two new, and the summary counts them', { timeout }, async (t) => {
  const head = edited(baseSnapshot, {
    global: { modularity: 0.55, crossShare: 0.31 },
    communities: { 1: null, 2: { edges: [edge('7', 12), edge('8', 8), edge('3', 5)] } },
    added: [
      community('7', 'auth (session)', { members: ['src/auth/audit.ts', 'src/auth/session.ts', 'src/auth/tokens.ts'], maintainability: 61.2, paths: 70, edges: [edge('8', 3), edge('3', 6)] }),
      community('8', 'auth (users)', { members: ['src/auth/invites.ts', 'src/auth/roles.ts', 'src/auth/users.ts'], maintainability: 57.9, paths: 52, edges: [edge('shared', 2)] }),
    ],
  });

  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, head), env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('Modularity 0.52 → 0.55 · cross share 0.26 → 0.31 · cycles 0 → 0 · communities 4 → 5 (2 new, 1 gone)', graph([
    '  c_auth["auth · gone<br/>4 files · MI 58.6 · paths 110"]',
    '  c_auth__session_["auth (session) · new<br/>3 files · MI 61.2 · paths 70"]',
    '  c_auth__users_["auth (users) · new<br/>3 files · MI 57.9 · paths 52"]',
    baseNodes.hostedAdmin,
    baseNodes.kernel,
    baseNodes.src,
    '  c_auth -. "gone" .-> c_hosted_admin',
    '  c_auth -. "gone" .-> c_shared_kernel',
    '  c_auth__session_ == "3 · new" ==> c_auth__users_',
    '  c_auth__session_ == "6 · new" ==> c_hosted_admin',
    '  c_auth__users_ == "2 · new" ==> c_shared_kernel',
    '  c_hosted_admin -- "4" --> c_shared_kernel',
    '  c_src -. "gone" .-> c_auth',
    '  c_src == "12 · new" ==> c_auth__session_',
    '  c_src == "8 · new" ==> c_auth__users_',
    '  c_src -- "5" --> c_hosted_admin',
    '  linkStyle 0 stroke:#999999,stroke-dasharray:4 4',
    '  linkStyle 1 stroke:#999999,stroke-dasharray:4 4',
    '  linkStyle 6 stroke:#999999,stroke-dasharray:4 4',
  ], ['  class c_auth gone']), { movements: ['', '### Unmatched community identity', '',
    '- `src/auth/roles.ts`: auth → auth (users).',
    '- `src/auth/session.ts`: auth → auth (session).',
    '- `src/auth/tokens.ts`: auth → auth (session).',
    '- `src/auth/users.ts`: auth → auth (users).',
  ] }));
  assert.equal(result.code, 0);
});

// hosted-admin loses 2.0 of maintainability and gets 6 decision paths, because its file routes.ts loses 4.0 and gets 6,
// and auth gets 2 references to it.
const headWithNewNumbers = edited(baseSnapshot, {
  communities: { 1: { edges: [edge('3', 12), edge('shared', 2)] }, 3: { maintainability: 64.6, paths: 81 } },
  files: { 'src/hosted-admin/routes.ts': { maintainability: 66, paths: 36 } },
});

test('Given --touched with a file of one community whose maintainability fell by 2.0, when the command runs, then that node has the touched class and its label shows the arrows and the changes, an edge shows the change of its references, and the complexity table after the legend has the row of the file', { timeout }, async (t) => {
  const args = [...snapshotArguments(t, baseSnapshot, headWithNewNumbers), '--touched', 'src/hosted-admin/routes.ts'];

  const result = await runScript(t, astMetricsArchitectureScript, { args, env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(equalSummary, graph([
    baseNodes.auth,
    '  c_hosted_admin["hosted-admin<br/>2 files · MI 64.6 ↓2.0 · paths 81 ↑6"]',
    baseNodes.kernel,
    baseNodes.src,
    '  c_auth -- "12 ↑2" --> c_hosted_admin',
    ...baseEdges.slice(1),
  ], ['  class c_hosted_admin touched']), { complexity: [
    complexityHeading,
    '',
    ...tableHead,
    '| src/hosted-admin/routes.ts | 70.0 → 66.0 ↓4.0 | 30 → 36 ↑6 | 6 |',
  ], components: componentGolden(Object.values({ ...componentNodes, hostedAdmin: '  c_hosted_admin["hosted-admin<br/>2 files · MI 64.6 ↓2.0 · paths 81 ↑6"]' }), ['  class c_hosted_admin touched']) }));
  assert.equal(result.code, 0);
});

test('Given a head whose numbers and references changed but whose communities, dependencies, and cycles did not, and no touched file, when the command runs, then it prints the unchanged-map line and the graph with the numeric deltas', { timeout }, async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, headWithNewNumbers), env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(equalSummary, ['The map did not change.', '', ...graph([
    baseNodes.auth,
    '  c_hosted_admin["hosted-admin<br/>2 files · MI 64.6 ↓2.0 · paths 81 ↑6"]',
    baseNodes.kernel,
    baseNodes.src,
    '  c_auth -- "12 ↑2" --> c_hosted_admin',
    ...baseEdges.slice(1),
  ])], { components: componentGolden(Object.values({ ...componentNodes, hostedAdmin: '  c_hosted_admin["hosted-admin<br/>2 files · MI 64.6 ↓2.0 · paths 81 ↑6"]' })) }));
  assert.equal(result.code, 0);
});

// GitHub's renderer fails silently on a double quote or a backtick in a label, and an id such as end is a keyword of
// Mermaid.
test('Given a new community whose label has a double quote and a backtick, when the command runs, then its label text has a single quote in place of each, and its id has an underscore in place of each character outside a-z and 0-9', { timeout }, async (t) => {
  const head = edited(baseSnapshot, { added: [community('9', 'quote " and tick `', { members: ['src/odd/quote.ts'], maintainability: 70, paths: 5 })] });

  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, head), env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown('Modularity 0.52 → 0.52 · cross share 0.26 → 0.26 · cycles 0 → 0 · communities 4 → 5 (1 new)', graph([
    baseNodes.auth,
    baseNodes.hostedAdmin,
    '  c_quote___and_tick__["quote \' and tick \' · new<br/>1 file · MI 70.0 · paths 5"]',
    baseNodes.kernel,
    baseNodes.src,
    ...baseEdges,
  ])));
  assert.equal(result.code, 0);
});

test('Given --out with a path in a new folder, when the command runs, then the file holds the Markdown that the command prints, relative to the current folder', { timeout }, async (t) => {
  const cwd = dataDirectory(t);
  const args = [...snapshotArguments(t, baseSnapshot, baseSnapshot), '--out', 'reports/new/architecture.md'];

  const result = await runScript(t, astMetricsArchitectureScript, { args, cwd, env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(equalSummary, ['The map did not change.', '', ...baseGraph]));
  assert.equal(result.code, 0);
  assert.equal(readFileSync(join(cwd, 'reports', 'new', 'architecture.md'), 'utf8'), result.stdout);
});
