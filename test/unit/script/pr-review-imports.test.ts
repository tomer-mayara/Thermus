import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { importStatementsOf } = await import(new URL('imports.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/imports.ts');

for (const [form, source, statement] of [
  ['import type', "import type { A } from './a.ts';", { specifier: './a.ts', kind: 'type' }],
  ['export type from', "export type { A } from './a.ts';", { specifier: './a.ts', kind: 'type' }],
  ['an import type node', "type A = typeof import('./a.ts');", { specifier: './a.ts', kind: 'type' }],
  ['import type equals require', "import type A = require('./a');", { specifier: './a', kind: 'type' }],
  ['a static import', "import { a } from './a.ts';", { specifier: './a.ts', kind: 'runtime' }],
  ['inline type specifiers only, which verbatimModuleSyntax keeps as import {}', "import { type A } from './a.ts';", { specifier: './a.ts', kind: 'runtime' }],
  ['a side-effect import', "import './a.css';", { specifier: './a.css', kind: 'runtime' }],
  ['a re-export', "export { a } from './a.ts';", { specifier: './a.ts', kind: 'runtime' }],
  ['a re-export of inline types only', "export { type A } from './a.ts';", { specifier: './a.ts', kind: 'runtime' }],
  ['a star re-export', "export * from './a.ts';", { specifier: './a.ts', kind: 'runtime' }],
  ['a dynamic import with a literal', "const a = await import('./a.ts');", { specifier: './a.ts', kind: 'runtime' }],
  ['a dynamic import with a template literal', 'const a = await import(`./a.ts`);', { specifier: './a.ts', kind: 'runtime' }],
  ['a dynamic import with a variable', 'const a = await import(name);', { kind: 'runtime' }],
] as const) {
  test(`Given ${form}, when the statements are read, then the kind is ${statement.kind}`, () => {
    assert.deepEqual(importStatementsOf('src/x.ts', source), [statement]);
  });
}

test('Given a file with several imports and a local export, when the statements are read, then each import gives one statement in source order', () => {
  const source = "import type { A } from 'x';\nimport b from 'y';\nexport const c = 1;\nexport { c as d };\n";

  assert.deepEqual(importStatementsOf('src/x.ts', source), [{ specifier: 'x', kind: 'type' }, { specifier: 'y', kind: 'runtime' }]);
});

test('Given JSX, when the statements are read, then a .tsx file parses and a .ts file does not', () => {
  const source = "import { a } from './a.ts';\n\nexport const view = <div>{a}</div>;\n";

  assert.deepEqual(importStatementsOf('src/view.tsx', source), [{ specifier: './a.ts', kind: 'runtime' }]);
  assert.equal(importStatementsOf('src/view.ts', source), undefined);
});

test('Given .mts and .cts files, when the statements are read, then they parse as TypeScript', () => {
  assert.deepEqual(importStatementsOf('src/a.mts', "import type { A } from './b.mts';\nexport const a: A = 1;\n"), [{ specifier: './b.mts', kind: 'type' }]);
  assert.deepEqual(importStatementsOf('src/a.cts', "import b = require('./b.cts');\n"), [{ specifier: './b.cts', kind: 'runtime' }]);
});

test('Given a declaration file, when the statements are read, then every statement is a type statement', () => {
  const source = "import { A } from './a.ts';\nexport { B } from './b.ts';\nexport declare const c: A;\n";

  assert.deepEqual(importStatementsOf('src/types.d.ts', source), [{ specifier: './a.ts', kind: 'type' }, { specifier: './b.ts', kind: 'type' }]);
});

test('Given a module augmentation and reference directives, when the statements are read, then the relative augmentation and each reference are type statements', () => {
  const source = '/// <reference path="globals.d.ts" />\n/// <reference types="vite/client" />\n'
    + "declare module './store.ts' {\n  interface Store { extra: number }\n}\ndeclare module 'adblock-rs' {\n  export const x: number;\n}\nexport {};\n";

  assert.deepEqual(importStatementsOf('src/a/augment.ts', source), [
    { specifier: './globals.d.ts', kind: 'type' },
    { specifier: 'vite/client', kind: 'type' },
    { specifier: './store.ts', kind: 'type' },
  ]);
});

test('Given a file that does not parse, when the statements are read, then there is no result', () => {
  assert.equal(importStatementsOf('src/x.ts', "import { a from './a.ts';\n"), undefined);
});
