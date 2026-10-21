import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(prReviewCheckScript);
const { dependencyOutcome } = await import(new URL('facts.ts', root).href) as typeof import('../../../script/pr-review/facts.ts');
const { sourceGraphOf } = await import(new URL('graph.ts', root).href) as typeof import('../../../script/pr-review/graph.ts');
type GraphRules = import('../../../script/pr-review/rules-graph.ts').GraphRules;

const sources = { 'src/a/a.ts': "import { b } from '../b/b.ts';\n", 'src/b/b.ts': 'export const b = 1;\n' };
const graph = sourceGraphOf(Object.keys(sources), new Map(Object.entries(sources)));
const changed = new Set(['src/a/a.ts']);
const edgeFact = {
  key: 'dependency_graph.triggers.edge_not_listed', text: 'a -> b (runtime)',
  declare: { key: 'dependency_graph.allowed_edges', value: '{ from: a, to: b, kind: runtime }' }, source: 'src/a/a.ts',
};

function view(change: Partial<GraphRules> = {}) {
  const graphRules: GraphRules = {
    packages: ['a', 'b'], allowedEdges: [], forbiddenEdges: [], knownCycles: [], externalImports: new Map(), nodeBuiltins: new Map(), ...change,
  };
  return { graph: graphRules, surface: { modules: ['src/b/b.ts'], contractDocuments: [] } };
}

const listed = view({ allowedEdges: [{ from: 'a', to: 'b', kind: 'runtime' }] });

test('Given an edge that the rules of the merge base lack and the rules of HEAD list, when the outcome is computed, then it is declared, not blocked', () => {
  assert.deepEqual(dependencyOutcome({ base: { graph, rules: view() }, head: { graph, rules: listed } }, changed), { fix: [], declared: [edgeFact], notes: [] });
});

test('Given an edge that both rules files lack, also under another trigger, when the outcome is computed, then it is blocked once', () => {
  const typeOnly = view({ allowedEdges: [{ from: 'a', to: 'b', kind: 'type' }] });

  assert.deepEqual(dependencyOutcome({ base: { graph, rules: view() }, head: { graph, rules: typeOnly } }, changed), {
    fix: [{ ...edgeFact, key: 'dependency_graph.triggers.type_edge_becomes_runtime' }], declared: [], notes: [],
  });
});

test('Given an edge that the merge base forbids and HEAD no longer forbids, when the outcome is computed, then it stays blocked', () => {
  const forbidden = view({ forbiddenEdges: [{ from: 'a', to: ['b'] }] });

  assert.deepEqual(dependencyOutcome({ base: { graph, rules: forbidden }, head: { graph, rules: listed } }, changed).fix, [
    { key: 'dependency_graph.triggers.forbidden_edge', text: 'a -> b (runtime)', source: 'src/a/a.ts' },
  ]);
});

test('Given an edge that only the rules of HEAD lack, when the outcome is computed, then it is blocked, because the merge would bring it to main unlisted', () => {
  assert.deepEqual(dependencyOutcome({ base: { graph, rules: listed }, head: { graph, rules: view() } }, changed), { fix: [edgeFact], declared: [], notes: [] });
});

test('Given unresolved imports, when the outcome is computed, then those in changed files are blocked and the others are notes', () => {
  const broken = { 'src/a/a.ts': "import { gone } from './gone.ts';\n", 'src/b/b.ts': "import './b.css';\n" };
  const brokenGraph = sourceGraphOf(Object.keys(broken), new Map(Object.entries(broken)));

  assert.deepEqual(dependencyOutcome({ base: { graph: brokenGraph, rules: view() }, head: { graph: brokenGraph, rules: view() } }, changed), {
    fix: [{ key: 'dependency_graph.counting.unresolved_relative_import', text: 'src/a/a.ts: ./gone.ts' }],
    declared: [],
    notes: ['Unresolved import in an unchanged file: src/b/b.ts: ./b.css'],
  });
});

test('Given a new cycle that the rules of HEAD list as known, when the outcome is computed, then the cycle fact of the merge base stays blocked', () => {
  const cycle = { 'src/a/a.ts': "import { b } from '../b/b.ts';\n", 'src/b/b.ts': "import { a } from '../a/a.ts';\nexport const b = 1;\n" };
  const cycleGraph = sourceGraphOf(Object.keys(cycle), new Map(Object.entries(cycle)));
  const edges = view({ allowedEdges: [{ from: 'a', to: 'b', kind: 'runtime' }, { from: 'b', to: 'a', kind: 'runtime' }] });
  const known = view({ ...edges.graph, knownCycles: [{ members: ['a', 'b'], kind: 'runtime' }] });

  const surface = { modules: ['src/a/a.ts', 'src/b/b.ts'], contractDocuments: [] };

  assert.deepEqual(dependencyOutcome({ base: { graph: cycleGraph, rules: { ...edges, surface } }, head: { graph: cycleGraph, rules: { ...known, surface } } }, changed), {
    fix: [{ key: 'dependency_graph.triggers.cycle_not_listed', text: 'a, b (runtime)' }], declared: [], notes: [],
  });
});
