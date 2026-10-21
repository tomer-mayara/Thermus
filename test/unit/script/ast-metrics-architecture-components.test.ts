import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import type { MapSnapshot, TableFile } from '../../../script/code-quality/architecture/types.ts';

const folder = new URL('architecture/', pathToFileURL(astMetricsArchitectureScript));
const { componentsOf } = await import(new URL('component-data.ts', folder).href) as typeof import('../../../script/code-quality/architecture/component-data.ts');
const { componentLinesOf } = await import(new URL('components.ts', folder).href) as typeof import('../../../script/code-quality/architecture/components.ts');
const { componentMapOf } = await import(new URL('component-map.ts', folder).href) as typeof import('../../../script/code-quality/architecture/component-map.ts');

const file = (path: string, edits: Partial<TableFile> = {}): TableFile => ({ path, loc: 10, paths: 2, maintainability: 80, ...edits });
function snapshot(files: readonly TableFile[], pairs: readonly { from: string; to: string; kinds: readonly ['static'] }[] = []): MapSnapshot {
  return { commit: 'a'.repeat(40), date: '2026-10-19', global: { modularity: 0, crossShare: 0, cycles: [], files: files.length, functions: 0, paths: 0 }, communities: [], files, dependencies: { version: 1, pairs, issues: [] } };
}
const pair = (from: string, to: string) => ({ from, to, kinds: ['static'] as const });

test('Given unequal file LOC and missing metrics, when components aggregate, then maintainability is weighted and unknown totals stay unknown', () => {
  const groups = componentsOf(snapshot([file('src/auth/a.ts'), file('src/auth/b.ts', { loc: 30, maintainability: 60.1 }), file('src/a.ts', { loc: undefined, paths: undefined })]));
  assert.equal(groups[0].name, 'auth');
  assert.equal(groups[0].maintainability, 65.1);
  assert.equal(groups[0].loc, 40);
  assert.equal(groups[0].paths, 4);
  assert.equal(groups[1].name, 'src');
  assert.equal(groups[1].loc, undefined);
  assert.equal(groups[1].paths, undefined);
  assert.equal(groups[1].maintainability, undefined);
});

test('Given complete member replacement and a proven folder move, when components match, then folder names stay stable and both move ends are touched', () => {
  const base = snapshot([file('src/auth/old.ts'), file('src/mcp/move.ts')]);
  const head = snapshot([file('src/auth/new.ts'), file('src/auth/move.ts')]);
  const map = componentMapOf({ base, head, touched: ['src/auth/move.ts'], changes: [{ status: 'R', oldPath: 'src/mcp/move.ts', path: 'src/auth/move.ts' }] }, undefined);
  assert.deepEqual(map.nodes.map(({ label, status, touched }) => [label, status, touched]), [['auth', 'kept', true], ['mcp', 'gone', true]]);
});

test('Given only internal imports, when a component map is made, then no self-loop or cycle exists', () => {
  const source = snapshot([file('src/auth/a.ts'), file('src/auth/b.ts')], [pair('src/auth/a.ts', 'src/auth/b.ts'), pair('src/auth/b.ts', 'src/auth/a.ts')]);
  const map = componentMapOf({ base: source, head: source, touched: [] }, undefined);
  assert.equal(map.nodes.length, 1);
  assert.deepEqual(map.edges, []);
  assert.equal(map.changed, false);
});

for (const legacy of [true, false]) {
  test(`Given ${legacy ? 'legacy missing' : 'incomplete'} dependencies, when components render, then unavailable edge evidence and withheld change claims are explicit`, () => {
    const base = snapshot([file('src/auth/a.ts'), file('src/mcp/b.ts')]);
    const head = { ...base, dependencies: legacy ? undefined : { version: 1 as const, pairs: [pair('src/auth/a.ts', 'src/mcp/b.ts')], issues: [{ path: 'src/auth/a.ts', reason: 'non-literal-dynamic' as const }] } };
    const lines = componentLinesOf({ base, head, touched: [] }, undefined).join('\n');
    assert.match(lines, /component edges and cycles are unavailable|Component dependency evidence is incomplete/);
    assert.doesNotMatch(lines, /== | · cycle/);
    assert.match(lines, /```mermaid/);
  });
}

test('Given new, gone and cycle dependencies, when components compare, then edge status and cycles follow complete file evidence', () => {
  const files = [file('src/a/one.ts'), file('src/b/two.ts'), file('src/c/three.ts')];
  const base = snapshot(files, [pair(files[0].path, files[1].path), pair(files[1].path, files[0].path)]);
  const head = snapshot(files, [pair(files[0].path, files[1].path), pair(files[1].path, files[2].path)]);
  const map = componentMapOf({ base, head, touched: [] }, undefined);
  assert.equal(map.changed, true);
  assert.deepEqual(map.edges.map(({ from, to, status, inCycle }) => [from.label, to.label, status, inCycle]), [
    ['a', 'b', 'kept', false], ['b', 'a', 'gone', false], ['b', 'c', 'new', false],
  ]);
});

test('Given legacy files without structural metrics, when components render, then unknown totals are explicit and no caller source is needed', () => {
  const source = snapshot([file('src/auth/a.ts', { loc: undefined, paths: undefined })]);
  const lines = componentLinesOf({ base: source, head: source, touched: [] }, undefined).join('\n');
  assert.match(lines, /per-file LOC or decision paths are absent/);
  assert.match(lines, /1 file · paths not measured/);
  assert.doesNotMatch(lines, /MI 0|paths 0/);
});

test('Given noncanonical legacy paths, when files group, then traversal does not create a component', () => {
  assert.deepEqual(componentsOf(snapshot([file('src/../bad.ts'), file('src//bad.ts')])), []);
});

test('Given nested ownership in each snapshot, when roots change under stable IDs, then the components and their dependency remain matched', () => {
  const oldPaths = ['src/domain/a/a.ts', 'src/transport/b/b.ts'];
  const newPaths = ['src/accounts/a/a.ts', 'src/interfaces/b/b.ts'];
  const base = { ...snapshot(oldPaths.map((path) => file(path)), [pair(oldPaths[0], oldPaths[1])]), ownership: { a: { roots: ['src/domain/a/'] }, b: { roots: ['src/transport/b/'] } } };
  const head = { ...snapshot(newPaths.map((path) => file(path)), [pair(newPaths[0], newPaths[1])]), ownership: { a: { roots: ['src/accounts/a/'] }, b: { roots: ['src/interfaces/b/'] } } };
  const map = componentMapOf({ base, head, touched: newPaths, changes: oldPaths.map((oldPath, index) => ({ status: 'R' as const, oldPath, path: newPaths[index] })) }, undefined);
  assert.deepEqual(map.nodes.map(({ label, status, touched }) => [label, status, touched]), [['a', 'kept', true], ['b', 'kept', true]]);
  assert.deepEqual(map.edges.map(({ from, to, status }) => [from.label, to.label, status]), [['a', 'b', 'kept']]);
});

test('Given legacy root files and an explicit app owner, when compared, then src continues as app without changing historical grouping', () => {
  const base = snapshot([file('src/index.ts')]);
  const head = { ...base, ownership: { app: { roots: ['src/app/'], files: ['src/index.ts'] } } };
  const map = componentMapOf({ base, head, touched: [] }, undefined);
  assert.deepEqual(map.nodes.map(({ label, status }) => [label, status]), [['app', 'kept']]);
  assert.equal(componentsOf(base)[0].name, 'src');
});

test('Given explicit snapshot owners and an unowned measured file, when components aggregate, then missing ownership cannot omit the file', () => {
  assert.throws(() => componentsOf({ ...snapshot([file('src/unowned.ts')]), ownership: { app: { roots: ['src/app/'], files: ['src/index.ts'] } } }), /no component owner/);
});

test('Given an existing CRAP delta for members in different tool communities, when a folder component renders, then its band uses the supplied complete member assessment', () => {
  const source = snapshot([file('src/auth/a.ts'), file('src/auth/b.ts')]);
  const baseFunctions = [{ name: 'risk', paths: 6, share: 0, crap: 42 }];
  const delta = {
    base: new Map(source.files.map(({ path }) => [path, { functions: baseFunctions, unmatched: 0 }])),
    head: new Map(source.files.map(({ path }) => [path, { functions: baseFunctions.map((fn) => ({ ...fn, base: 30, addedOrWorse: true, classification: 'changed' as const })), unmatched: 0 }])),
    unknownIdentity: 0,
  };
  const map = componentMapOf({ base: source, head: source, touched: [] }, delta);
  assert.equal(map.nodes[0].band?.band, 'critical');
  assert.equal(map.nodes[0].band?.count, 2);
});

test('Given incomplete evidence with a proven head cycle and a removed base edge, when components compare, then only observed head edges have neutral status and proven cycle marks', () => {
  const files = [file('src/a/one.ts'), file('src/b/two.ts'), file('src/c/three.ts')];
  const base = snapshot(files, [pair(files[0].path, files[2].path)]);
  const head = { ...snapshot(files, [pair(files[0].path, files[1].path), pair(files[1].path, files[0].path)]), dependencies: {
    version: 1 as const, pairs: [pair(files[0].path, files[1].path), pair(files[1].path, files[0].path)], issues: [{ path: files[0].path, reason: 'unresolved-local' as const }],
  } };
  const map = componentMapOf({ base, head, touched: [] }, undefined);
  assert.deepEqual(map.edges.map(({ status, change, inCycle }) => [status, change, inCycle]), [['kept', 0, true], ['kept', 0, true]]);
  const lines = componentLinesOf({ base, head, touched: [] }, undefined).join('\n');
  assert.match(lines, /Additional dependencies or cycles may exist/);
  assert.doesNotMatch(lines, /The component map did not change/);
});
