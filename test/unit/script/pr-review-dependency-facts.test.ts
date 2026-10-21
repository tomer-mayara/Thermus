import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(prReviewCheckScript);
const { factsOf } = await import(new URL('dependency-facts.ts', root).href) as typeof import('../../../script/pr-review/dependency-facts.ts');
const { sourceGraphOf } = await import(new URL('graph.ts', root).href) as typeof import('../../../script/pr-review/graph.ts');
type GraphRules = import('../../../script/pr-review/rules-graph.ts').GraphRules;

function graphRules(change: Partial<GraphRules> = {}): GraphRules {
  return {
    packages: ['a', 'b', 'composition'], allowedEdges: [], forbiddenEdges: [], knownCycles: [],
    externalImports: new Map(), nodeBuiltins: new Map(), ...change,
  };
}

function factsFor(sources: Readonly<Record<string, string>>, graph: GraphRules, options: { surface?: readonly string[]; changed?: readonly string[] } = {}) {
  const sourceGraph = sourceGraphOf(Object.keys(sources), new Map(Object.entries(sources)));
  return factsOf(sourceGraph, { graph, surface: { modules: options.surface ?? [] } }, new Set(options.changed ?? Object.keys(sources)));
}

const twoPackages = { 'src/a/a.ts': "import { b } from '../b/b.ts';\n", 'src/b/b.ts': 'export const b = 1;\n', 'src/index.ts': 'export {};\n' };

test('Given an edge that the rules do not list, when the facts are computed, then it is edge_not_listed with the entry that would list it', () => {
  assert.deepEqual(factsFor(twoPackages, graphRules(), { surface: ['src/b/b.ts'] }), [{
    key: 'dependency_graph.triggers.edge_not_listed',
    text: 'a -> b (runtime)',
    declare: { key: 'dependency_graph.allowed_edges', value: '{ from: a, to: b, kind: runtime }' },
    source: 'src/a/a.ts',
  }]);
});

test('Given a runtime edge that the rules list as type, when the facts are computed, then it is type_edge_becomes_runtime', () => {
  const facts = factsFor(twoPackages, graphRules({ allowedEdges: [{ from: 'a', to: 'b', kind: 'type' }] }), { surface: ['src/b/b.ts'] });

  assert.deepEqual(facts.map((fact) => [fact.key, fact.text]), [['dependency_graph.triggers.type_edge_becomes_runtime', 'a -> b (runtime)']]);
});

test('Given edges within their listed kind, when the facts are computed, then there is no fact', () => {
  const typeEdge = { ...twoPackages, 'src/a/a.ts': "import type { B } from '../b/b.ts';\n" };

  assert.deepEqual(factsFor(twoPackages, graphRules({ allowedEdges: [{ from: 'a', to: 'b', kind: 'both' }] }), { surface: ['src/b/b.ts'] }), []);
  assert.deepEqual(factsFor(typeEdge, graphRules({ allowedEdges: [{ from: 'a', to: 'b', kind: 'type' }] }), { surface: ['src/b/b.ts'] }), []);
  assert.deepEqual(factsFor(typeEdge, graphRules({ allowedEdges: [{ from: 'a', to: 'b', kind: 'runtime' }] }), { surface: ['src/b/b.ts'] }), []);
});

test('Given an edge in a forbidden list, when the facts are computed, then it is forbidden_edge with no entry to list it, also when allowed_edges lists it', () => {
  const rules = graphRules({ allowedEdges: [{ from: 'a', to: 'b', kind: 'both' }], forbiddenEdges: [{ from: 'a', to: ['composition', 'b'] }] });

  assert.deepEqual(factsFor(twoPackages, rules, { surface: ['src/b/b.ts'] }), [{ key: 'dependency_graph.triggers.forbidden_edge', text: 'a -> b (runtime)', source: 'src/a/a.ts' }]);
});

test('Given a package that the rules do not list and a listed package without files, when the facts are computed, then both are facts of the package list', () => {
  const facts = factsFor({ 'src/c/c.ts': 'export {};\n', 'src/index.ts': 'export {};\n' }, graphRules({ packages: ['a', 'composition'] }));

  assert.deepEqual(facts, [
    { key: 'dependency_graph.triggers.folder_not_listed', text: 'c', declare: { key: 'dependency_graph.packages', value: 'c' } },
    { key: 'dependency_graph.triggers.package_removed', text: 'a has no files at HEAD', declare: { key: 'dependency_graph.packages', value: 'remove a' } },
  ]);
});

test('Given external imports of a package, when the facts are computed, then each npm package or builtin that its lists lack is a fact with the list to add it to', () => {
  const sources = { 'src/a/a.ts': "import { x } from 'jose';\nimport { y } from 'better-auth/oauth2';\nimport { z } from 'node:fs';\nimport { w } from 'node:path';\n" };
  const rules = graphRules({ packages: ['a'], externalImports: new Map([['a', ['jose']]]), nodeBuiltins: new Map([['a', ['node:path']]]) });

  assert.deepEqual(factsFor(sources, rules), [
    { key: 'dependency_graph.triggers.external_import_not_listed', text: 'a: better-auth', declare: { key: 'dependency_graph.allowed_external_imports.a', value: 'better-auth' }, source: 'src/a/a.ts' },
    { key: 'dependency_graph.triggers.external_import_not_listed', text: 'a: node:fs', declare: { key: 'dependency_graph.allowed_node_builtins.a', value: 'node:fs' }, source: 'src/a/a.ts' },
  ]);
});

test('Given a changed file that imports a file of another package outside the public surface, when the facts are computed, then it is a fact of between_packages; composition and unchanged files have none', () => {
  const sources = {
    'src/a/a.ts': "import type { B } from '../b/inner.ts';\n", 'src/a/old.ts': "import type { B } from '../b/inner.ts';\n",
    'src/b/inner.ts': 'export interface B {}\n', 'src/index.ts': "import type { B } from './b/inner.ts';\n",
  };
  const rules = graphRules({ allowedEdges: [{ from: 'a', to: 'b', kind: 'type' }, { from: 'composition', to: 'b', kind: 'type' }] });

  assert.deepEqual(factsFor(sources, rules, { changed: ['src/a/a.ts', 'src/index.ts'] }), [{
    key: 'dependency_graph.triggers.cross_package_file_not_in_public_surface',
    text: 'src/b/inner.ts (imported by src/a/a.ts)',
    declare: { key: 'public_surface.between_packages.b', value: 'src/b/inner.ts' },
  }]);
  assert.deepEqual(factsFor(sources, rules, { changed: ['src/a/a.ts'], surface: ['src/b/inner.ts'] }), []);
});

test('Given a listed edge that joins two members of a known cycle only as a type edge, when the facts are computed, then the runtime use makes the known cycle grow', () => {
  const sources = { 'src/a/a.ts': "import { b } from '../b/b.ts';\n", 'src/b/b.ts': "import type { A } from '../a/a.ts';\nexport const b = 1;\n" };
  const rules = graphRules({
    packages: ['a', 'b'],
    allowedEdges: [{ from: 'a', to: 'b', kind: 'type' }, { from: 'b', to: 'a', kind: 'type' }],
    knownCycles: [{ members: ['a', 'b'], kind: 'all' }],
  });

  assert.deepEqual(factsFor(sources, rules, { surface: ['src/a/a.ts', 'src/b/b.ts'] }).map((fact) => [fact.key, fact.text, fact.declare]), [
    ['dependency_graph.triggers.type_edge_becomes_runtime', 'a -> b (runtime)', { key: 'dependency_graph.allowed_edges', value: '{ from: a, to: b, kind: runtime }' }],
    ['dependency_graph.triggers.known_cycle_grows', 'a -> b (runtime) inside the known cycle a, b', undefined],
  ]);
});
