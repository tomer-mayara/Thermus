import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { cycleFacts } = await import(new URL('cycles.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/cycles.ts');

type Kind = 'type' | 'runtime';
type KnownCycle = { readonly members: readonly string[]; readonly kind: 'runtime' | 'all' };

function edgesOf(...edges: readonly (readonly [string, string, Kind])[]) {
  return edges.map(([from, to, kind]) => ({ from, to, kind, source: `src/${from}/x.ts` }));
}

// Every edge is listed with its kind, so that only the components decide.
function factsOf(edges: ReturnType<typeof edgesOf>, knownCycles: readonly KnownCycle[]) {
  return cycleFacts(edges, { knownCycles, allowedEdges: edges.map(({ from, to, kind }) => ({ from, to, kind })) });
}

const runtimeCycle = { members: ['auth', 'hosted-admin'], kind: 'runtime' } as const;
const allCycle = { members: ['auth', 'hosted-admin', 'organizations'], kind: 'all' } as const;
const knownEdges = edgesOf(
  ['auth', 'hosted-admin', 'runtime'], ['hosted-admin', 'auth', 'runtime'], ['auth', 'organizations', 'runtime'],
  ['organizations', 'auth', 'type'], ['composition', 'auth', 'runtime'],
);

test('Given a graph without known cycles, when the cycles are checked, then each component of two or more packages gives one fact, sorted', () => {
  const edges = edgesOf(['c', 'a', 'runtime'], ['a', 'b', 'runtime'], ['b', 'c', 'runtime'], ['d', 'a', 'runtime'], ['e', 'f', 'runtime'], ['f', 'e', 'type']);

  assert.deepEqual(factsOf(edges, []).map((fact) => fact.text), ['a, b, c (runtime)', 'e, f (all)']);
  assert.deepEqual(factsOf(edgesOf(['a', 'b', 'runtime']), []), []);
});

test('Given the known cycles of the rules file and a graph that matches them, when the cycles are checked, then there is no fact', () => {
  assert.deepEqual(factsOf(knownEdges, [runtimeCycle, allCycle]), []);
});

test('Given a runtime cycle with the same members as the cycle of all edges, when the cycles are checked, then one runtime fact names it, with no entry that could declare it', () => {
  assert.deepEqual(factsOf(edgesOf(['alpha', 'beta', 'runtime'], ['beta', 'alpha', 'runtime']), []), [
    { key: 'dependency_graph.triggers.cycle_not_listed', text: 'alpha, beta (runtime)' },
  ]);
});

test('Given a new cycle of type edges only, when the cycles are checked, then the fact is a cycle of all edges', () => {
  const facts = factsOf(edgesOf(['alpha', 'beta', 'type'], ['beta', 'alpha', 'type']), [runtimeCycle]);

  assert.deepEqual(facts.map((fact) => [fact.key, fact.text]), [['dependency_graph.triggers.cycle_not_listed', 'alpha, beta (all)']]);
});

test('Given a known runtime cycle that gains a member, when the cycles are checked, then the fact says that the known cycle grows', () => {
  const edges = [...knownEdges, ...edgesOf(['hosted-admin', 'billing', 'runtime'], ['billing', 'auth', 'runtime'])];

  assert.deepEqual(factsOf(edges, [runtimeCycle, allCycle]).map((fact) => [fact.key, fact.text]), [
    ['dependency_graph.triggers.known_cycle_grows', 'auth, billing, hosted-admin (runtime)'],
    ['dependency_graph.triggers.known_cycle_grows', 'auth, billing, hosted-admin, organizations (all)'],
  ]);
});

test('Given a known type cycle whose edge becomes runtime, when the cycles are checked, then the runtime cycle grows', () => {
  const edges = edgesOf(['auth', 'hosted-admin', 'runtime'], ['hosted-admin', 'auth', 'runtime'], ['auth', 'organizations', 'runtime'], ['organizations', 'auth', 'runtime']);

  assert.deepEqual(factsOf(edges, [runtimeCycle, allCycle]).map((fact) => [fact.key, fact.text]), [
    ['dependency_graph.triggers.known_cycle_grows', 'auth, hosted-admin, organizations (runtime)'],
  ]);
});

test('Given a known cycle that shrinks, when the cycles are checked, then there is no fact', () => {
  assert.deepEqual(factsOf(edgesOf(['auth', 'organizations', 'runtime'], ['organizations', 'auth', 'type']), [runtimeCycle, allCycle]), []);
});

test('Given a new edge between two members of a known cycle, when the cycles are checked, then the known cycle grows unless allowed_edges covers the edge and its kind', () => {
  const knownCycles = [{ members: ['alpha', 'beta', 'gamma'], kind: 'runtime' }] as const;
  const allowedEdges = [{ from: 'alpha', to: 'beta', kind: 'runtime' }, { from: 'beta', to: 'gamma', kind: 'type' }] as const;
  const edges = edgesOf(['alpha', 'beta', 'runtime'], ['beta', 'gamma', 'runtime'], ['gamma', 'beta', 'type'], ['gamma', 'delta', 'runtime']);

  assert.deepEqual(cycleFacts(edges, { knownCycles, allowedEdges }), [
    { key: 'dependency_graph.triggers.known_cycle_grows', text: 'beta -> gamma (runtime) inside the known cycle alpha, beta, gamma', source: 'src/beta/x.ts' },
    { key: 'dependency_graph.triggers.known_cycle_grows', text: 'gamma -> beta (type) inside the known cycle alpha, beta, gamma', source: 'src/gamma/x.ts' },
  ]);
});
