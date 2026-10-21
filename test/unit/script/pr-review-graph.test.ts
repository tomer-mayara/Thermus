import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(prReviewCheckScript);
const { packageOf, sourceGraphOf } = await import(new URL('graph.ts', root).href) as typeof import('../../../script/pr-review/graph.ts');
const { externalNameOf } = await import(new URL('external.ts', root).href) as typeof import('../../../script/pr-review/external.ts');

function graphOf(sources: Readonly<Record<string, string>>, otherPaths: readonly string[] = []) {
  return sourceGraphOf([...Object.keys(sources), ...otherPaths], new Map(Object.entries(sources)));
}

test('Given source paths, when their package is named, then it is the first folder under src/, or composition for a file directly in src/', () => {
  assert.equal(packageOf('src/auth/hosted-auth/workos/workos-signup.ts'), 'auth');
  assert.equal(packageOf('src/user-portal/style.css'), 'user-portal');
  assert.equal(packageOf('src/index.ts'), 'composition');
});

for (const [specifier, name, builtin] of [
  ['better-auth/oauth2', 'better-auth', false],
  ['@workos-inc/node', '@workos-inc/node', false],
  ['@modelcontextprotocol/server/sub/path', '@modelcontextprotocol/server', false],
  ['node:dns/promises', 'node:dns/promises', true],
  ['node:fs', 'node:fs', true],
  ['fs', 'node:fs', true],
] as const) {
  test(`Given the external specifier ${specifier}, when it is named, then the rules file lists it as ${name}`, () => {
    assert.deepEqual(externalNameOf(specifier), { name, builtin });
  });
}

test('Given type and runtime imports between packages, when the graph is built, then an edge is runtime if one statement is runtime, and names the first file that makes it so', () => {
  const graph = graphOf({
    'src/a/one.ts': "import type { B } from '../b/b.ts';\n",
    'src/a/two.ts': "import { b } from '../b/b.ts';\nimport { c } from '../c/c.ts';\n",
    'src/a/three.ts': "import { type C } from '../c/c.ts';\nimport { one } from './one.ts';\n",
    'src/b/b.ts': "import type { C } from '../c/c.ts';\nexport const b = 1;\n",
    'src/c/c.ts': 'export const c = 1;\n',
  });

  assert.deepEqual(graph.edges, [
    { from: 'a', to: 'b', kind: 'runtime', source: 'src/a/two.ts' },
    { from: 'a', to: 'c', kind: 'runtime', source: 'src/a/three.ts' },
    { from: 'b', to: 'c', kind: 'type', source: 'src/b/b.ts' },
  ]);
  assert.deepEqual(graph.imports.get('src/a/three.ts'), [{ target: 'src/c/c.ts', kind: 'runtime' }, { target: 'src/a/one.ts', kind: 'runtime' }]);
});

test('Given external imports, when the graph is built, then each package lists each npm package or builtin once with the first file', () => {
  const graph = graphOf({
    'src/a/one.ts': "import { betterAuth } from 'better-auth';\nimport { readFile } from 'node:fs/promises';\n",
    'src/a/two.ts': "import { oauth } from 'better-auth/oauth2';\nimport type { Plugin } from 'vite';\n",
    'src/index.ts': "import { join } from 'node:path';\n",
  });

  assert.deepEqual(graph.externals, [
    { owner: 'a', name: 'better-auth', builtin: false, source: 'src/a/one.ts' },
    { owner: 'a', name: 'node:fs/promises', builtin: true, source: 'src/a/one.ts' },
    { owner: 'a', name: 'vite', builtin: false, source: 'src/a/two.ts' },
    { owner: 'composition', name: 'node:path', builtin: true, source: 'src/index.ts' },
  ]);
});

test('Given imports whose target is missing, when the graph is built, then each is unresolved once with its file and specifier', () => {
  const graph = graphOf({
    'src/a/one.ts': "import { gone } from './gone.ts';\nimport { again } from './gone.ts';\nimport data from '#data/x.json';\nconst page = await import(name);\n",
    'src/a/broken.ts': "import { a from './one.ts';\n",
  });

  assert.deepEqual(graph.unresolved, [
    { file: 'src/a/broken.ts', detail: 'the file does not parse' },
    { file: 'src/a/one.ts', detail: './gone.ts' },
    { file: 'src/a/one.ts', detail: '#data/x.json' },
    { file: 'src/a/one.ts', detail: 'a dynamic import with an argument that is not a literal' },
  ]);
  assert.deepEqual(graph.edges, []);
});

test('Given an import of a stylesheet or a data file that exists, when the graph is built, then it is an asset with no edge and no fact', () => {
  const graph = graphOf({ 'src/a/one.ts': "import './style.css';\nimport data from '../b/data.json' with { type: 'json' };\n" }, ['src/a/style.css', 'src/b/data.json']);

  assert.deepEqual(graph.unresolved, []);
  assert.deepEqual(graph.edges, []);
});

test('Given imports that TypeScript resolves to other TypeScript files, when the graph is built, then each finds its target', () => {
  const graph = graphOf({
    'src/a/one.ts': "import { b } from '../b/b.mjs';\nimport { View } from '../c/view.js';\nimport type { T } from '../d/types.js';\nimport { w } from '../e/widget';\n",
    'src/b/b.mts': 'export const b = 1;\n', 'src/c/view.tsx': 'export const View = 1;\n', 'src/d/types.d.ts': 'export type T = 1;\n', 'src/e/widget.tsx': 'export const w = 1;\n',
  });

  assert.deepEqual(graph.imports.get('src/a/one.ts')?.map((entry) => entry.target), ['src/b/b.mts', 'src/c/view.tsx', 'src/d/types.d.ts', 'src/e/widget.tsx']);
  assert.deepEqual(graph.unresolved, []);
});

test('Given a JavaScript file under src, when the graph is built, then it is unresolved because the check reads TypeScript only, and an import of it finds it', () => {
  const graph = graphOf({ 'src/a/one.ts': "import { legacy } from '../b/legacy.js';\n" }, ['src/b/legacy.js']);

  assert.deepEqual(graph.unresolved, [{ file: 'src/b/legacy.js', detail: 'the check reads TypeScript only' }]);
  assert.deepEqual(graph.edges.map((edge) => [edge.from, edge.to]), [['a', 'b']]);
});

test('Given every path under src/, when the graph is built, then the packages include a folder without TypeScript', () => {
  const graph = graphOf({ 'src/index.ts': 'export const a = 1;\n', 'src/a/a.ts': 'export const a = 1;\n' }, ['src/assets/logo.svg']);

  assert.deepEqual(graph.packages, ['a', 'assets', 'composition']);
});
