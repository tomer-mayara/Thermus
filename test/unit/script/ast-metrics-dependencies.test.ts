import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { DependencyEvidence } from '../../../script/code-quality/dependencies/types.ts';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const { dependenciesOf } = await import(new URL('dependencies/source.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/dependencies/source.ts');

function evidence(text: string, others = ['src/b.ts', 'src/dir/index.ts']): DependencyEvidence {
  return dependenciesOf(new Map([['src/a.ts', text], ...others.map((path) => [path, ''] as const)]));
}

test('Given all supported import forms, when parsed, then dependency kinds are deduplicated and sorted for each normalized pair', () => {
  const result = evidence(`import value, { type B }\nfrom './b.js';
import type { B } from './b.ts';
import { type B } from './b';
import './b.js';
export { value } from './b.js';
export type { B } from './b.js';
export { type B } from './b.js';
const load = () => import('./b.js');
export * from './dir';
type X = import('./b.js').B;`);
  assert.deepEqual(result, { version: 1, pairs: [
    { from: 'src/a.ts', to: 'src/b.ts', kinds: ['dynamic', 're-export', 'side-effect', 'static', 'type'] },
    { from: 'src/a.ts', to: 'src/dir/index.ts', kinds: ['re-export'] },
  ], issues: [] });
});

test('Given comments, strings, packages and import.meta, when parsed, then none create internal dependencies', () => {
  assert.deepEqual(evidence(`// import './missing.js';
const a = "import('./missing.js')";
/* export * from './absent.js'; */
import x from 'package';
import 'node:fs';
const here = import.meta.url;`), { version: 1, pairs: [], issues: [] });
});

test('Given unresolved, outside, alias and computed imports, when parsed, then unknown dependencies are explicit', () => {
  assert.deepEqual(evidence(`import './missing.js'; import '../outside.js'; import '#alias'; import '/absolute.js'; import(name);`), {
    version: 1, pairs: [], issues: [
      { path: 'src/a.ts', reason: 'non-literal-dynamic' },
      { path: 'src/a.ts', specifier: '#alias', reason: 'unsupported-alias' },
      { path: 'src/a.ts', specifier: '../outside.js', reason: 'outside-src' },
      { path: 'src/a.ts', specifier: './missing.js', reason: 'unresolved-local' },
      { path: 'src/a.ts', specifier: '/absolute.js', reason: 'outside-src' },
    ],
  });
});

test('Given an invalid source, when parsed, then it reports incomplete evidence and keeps no speculative edges', () => {
  assert.deepEqual(evidence(`import './b.js'; const broken = ;`), { version: 1, pairs: [], issues: [{ path: 'src/a.ts', reason: 'parse-error' }] });
});

test('Given explicit and extensionless paths, when parsed, then known files take precedence over directory indexes and no runtime suffix is guessed', () => {
  assert.deepEqual(evidence(`import './dir'; import './b.mjs'; import './x/../b.ts'; import './dir/index.ts';`, ['src/b.ts', 'src/dir.ts', 'src/dir/index.ts']), {
    version: 1, pairs: [
      { from: 'src/a.ts', to: 'src/b.ts', kinds: ['side-effect'] },
      { from: 'src/a.ts', to: 'src/dir.ts', kinds: ['side-effect'] },
      { from: 'src/a.ts', to: 'src/dir/index.ts', kinds: ['side-effect'] },
    ], issues: [{ path: 'src/a.ts', specifier: './b.mjs', reason: 'unresolved-local' }],
  });
});

test('Given directory paths and a literal template import, when parsed, then root and folder index files resolve inside src', () => {
  assert.deepEqual(evidence('import "./"; import "./dir/"; import(`./b.js`);', ['src/index.ts', 'src/dir/index.ts', 'src/b.ts']), {
    version: 1, pairs: [
      { from: 'src/a.ts', to: 'src/b.ts', kinds: ['dynamic'] },
      { from: 'src/a.ts', to: 'src/dir/index.ts', kinds: ['side-effect'] },
      { from: 'src/a.ts', to: 'src/index.ts', kinds: ['side-effect'] },
    ], issues: [],
  });
});

test('Given a measured file without source text, when dependencies are collected, then it cannot be mistaken for a file without imports', () => {
  assert.deepEqual(dependenciesOf(new Map(), ['src/a.ts']), { version: 1, pairs: [], issues: [{ path: 'src/a.ts', reason: 'parse-error' }] });
});

test('Given TypeScript external module imports, when parsed, then value and type-only imports retain their kinds', () => {
  assert.deepEqual(evidence('import value = require("./b.js"); import type B = require("./b.js");'), {
    version: 1, pairs: [{ from: 'src/a.ts', to: 'src/b.ts', kinds: ['static', 'type'] }], issues: [],
  });
});
