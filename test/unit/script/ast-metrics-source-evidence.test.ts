import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { SnapshotFunction } from '../../../script/code-quality/snapshot/types.ts';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const { functionEvidenceOf } = await import(new URL('identity/source.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/identity/source.ts');
const metrics = (names: readonly string[]): SnapshotFunction[] => names.map((name) => ({ name, paths: 1, loc: 1 }));
const evidence = (text: string, names: readonly string[] = ['sample']) => functionEvidenceOf({ path: 'src/example.ts', text }, metrics(names));
function identity(text: string) {
  const result = evidence(text).functions[0]?.identity;
  assert.ok(result);
  return result;
}

test('Given a named declaration, when source evidence is read, then it has source coordinates, kind, lexical owner, and versioned fingerprints', () => {
  const source = 'class Store { sample(value: string) { return value; } }';
  const result = evidence(source).functions[0]?.identity;
  assert.ok(result);
  assert.equal(result.kind, 'MethodDeclaration');
  assert.equal(result.owner, 'ClassDeclaration:Store');
  assert.equal(result.name, 'sample');
  assert.equal(source.slice(result.start, result.end), 'sample(value: string) { return value; }');
  assert.match(result.body, /^[a-f0-9]{64}$/u);
  assert.match(result.signature, /^[a-f0-9]{64}$/u);
});

test('Given only whitespace and comment changes, when evidence is compared, then body and signature are unchanged', () => {
  const before = identity('function sample(value: string) { return value.trim(); }');
  const after = identity('function /* binding */ sample ( value : string ) { /* body */ return value . trim ( ) ; }');
  assert.equal(before.body, after.body);
  assert.equal(before.signature, after.signature);
});

for (const [before, after] of [
  ['return "a b";', 'return "ab";'],
  ['return /a b/g;', 'return /ab/g;'],
  ['return `a b${value}`;', 'return `ab${value}`;'],
  ['return\nvalue;', 'return value;'],
  ['let value = 1; value\n++value;', 'let value = 1; value++\nvalue;'],
]) {
  test(`Given executable token or ASI changes (${before}), when evidence is compared, then body fingerprints differ`, () => {
    assert.notEqual(identity(`function sample(value: string) { ${before} }`).body, identity(`function sample(value: string) { ${after} }`).body);
  });
}

test('Given a simple rename, when fingerprints are compared, then only the declaration binding is excluded and recursive calls stay visible', () => {
  const renamed = evidence('function renamed(value: string) { return value; }', ['renamed']).functions[0]?.identity;
  const original = identity('function sample(value: string) { return value; }');
  assert.ok(renamed);
  assert.equal(original.body, renamed.body);
  assert.equal(original.signature, renamed.signature);
  const recursive = evidence('function renamed(value: string) { return renamed(value); }', ['renamed']).functions[0]?.identity;
  assert.ok(recursive);
  assert.notEqual(identity('function sample(value: string) { return sample(value); }').body, recursive.body);
});

test('Given a signature edit, when fingerprints are compared, then body stays equal and signature differs', () => {
  const before = identity('function sample(value: string) { return value; }');
  const after = identity('function sample(value: number) { return value; }');
  assert.equal(before.body, after.body);
  assert.notEqual(before.signature, after.signature);
});

for (const [text, names] of [
  ['class A { sample() {} } class B { sample() {} }', ['sample']],
  ['function sample() {}', ['sample', 'sample']],
  ['export default () => 1;', ['(anonymous)']],
  ['function sample( {', ['sample']],
  ['const sample = 1;', ['sample']],
] as const) {
  test(`Given ambiguous or unsupported source ${text}, when evidence is attached, then it stays unknown`, () => {
    const result = evidence(text, names);
    assert.ok(result.functions.every((entry) => entry.identity === undefined));
    assert.equal(result.sourceEvidence.complete, false);
  });
}

test('Given an identifier-bound arrow nested in a named function, when evidence is captured, then each declaration has a lexical owner', () => {
  const result = evidence('function outer() { const sample = (value: number) => value + 1; }', ['outer', 'sample']);
  assert.equal(result.sourceEvidence.complete, true);
  assert.equal(result.functions[1]?.identity?.kind, 'ArrowFunction');
  assert.equal(result.functions[1]?.identity?.owner, 'FunctionDeclaration:outer');
});

test('Given class-qualified MCP names, when evidence is captured, then unique methods and constructors attach without confusing another class', () => {
  const source = 'class Store { constructor() {} sample() {} } class Other { sample() {} }';
  const result = evidence(source, ['example\\Store.constructor', 'example\\Store.sample', 'example\\Other.sample']);
  assert.equal(result.sourceEvidence.complete, true);
  assert.deepEqual(result.functions.map((entry) => entry.identity?.owner), ['ClassDeclaration:Store', 'ClassDeclaration:Store', 'ClassDeclaration:Other']);
  assert.deepEqual(result.functions.map((entry) => entry.identity?.name), ['constructor', 'sample', 'sample']);
});

test('Given getter and setter with the same metric name, when evidence is attached, then both remain unknown', () => {
  const result = evidence('class Store { get sample() { return 1; } set sample(value: number) {} }', ['example\\Store.sample', 'example\\Store.sample']);
  assert.ok(result.functions.every((entry) => entry.identity === undefined));
  assert.equal(result.sourceEvidence.complete, false);
});

test('Given an arrow variable type edit, when fingerprints are compared, then its signature changes', () => {
  const before = identity('const sample: (value: string) => string = value => value;');
  const after = identity('const sample: (value: number) => number = value => value;');
  assert.ok(before);
  assert.ok(after);
  assert.equal(before.body, after.body);
  assert.notEqual(before.signature, after.signature);
});

test('Given a body with comments only, when comments change, then normalized fingerprints stay equal', () => {
  assert.equal(identity('function sample() { /* one */ }').body, identity('function sample() { /* two */ }').body);
});

test('Given overload declarations, when metrics cannot identify one source declaration, then identity stays unknown', () => {
  const result = evidence('function sample(value: string): string; function sample(value: number): number; function sample(value: string | number) { return value; }');
  assert.equal(result.functions[0]?.identity, undefined);
  assert.equal(result.sourceEvidence.complete, false);
});

test('Given JSDoc changes on a declaration or nested statement, when fingerprints are compared, then comments are ignored', () => {
  const before = identity('/** one */ function sample() { /** nested one */ const value = 1; return value; }');
  const after = identity('/** two */ function sample() { /** nested two */ const value = 1; return value; }');
  assert.equal(before.body, after.body);
  assert.equal(before.signature, after.signature);
});
