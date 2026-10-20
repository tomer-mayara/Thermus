import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const { snapshotOf } = await import(new URL('snapshot/build.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/snapshot/build.ts');

function fileWith(answer: string, sourceText?: string) {
  const path = 'src/value.ts';
  return JSON.parse(JSON.stringify(snapshotOf({
    commit: 'c0ffee', date: '2026-10-18T00:00:00-06:00',
    files: [{ path, paths: 0, loc: 1, maintainability: 91.23 }],
    communities: '{}', functions: new Map([[path, answer]]),
    ...(sourceText === undefined ? {} : { sourceTexts: new Map([[path, sourceText]]) }),
  }))).files[0];
}

test('Given no native classes key, when a snapshot is built, then class observations stay absent even when function source evidence is complete', () => {
  const file = fileWith('{}', 'export const value = 1;\n');

  assert.equal(file.sourceEvidence.complete, true);
  assert.equal(Object.hasOwn(file, 'classObservations'), false);
});

test('Given an empty native classes array, when a snapshot is built, then the empty response is retained without class completeness or identity', () => {
  const file = fileWith('{"classes":[]}', 'export class Actual {}\n');

  assert.deepEqual(file.classObservations, []);
  assert.deepEqual(Object.keys(file).filter((key) => key.toLowerCase().includes('class')), ['classObservations']);
});

test('Given native class labels with duplicates, prefixes and an empty label, when a snapshot is built, then their order and names stay verbatim without source identity', () => {
  const file = fileWith(JSON.stringify({ classes: [{ name: 'src/value::Same' }, { name: '' }, { name: 'src/value::Same', maintainability: {} }] }), 'export class Actual {}\n');

  assert.deepEqual(file.classObservations, [{ name: 'src/value::Same' }, { name: '' }, { name: 'src/value::Same' }]);
  assert.equal(file.maintainabilityRaw, 91.23);
});

test('Given finite native class MI, when a snapshot is built, then zero, negative, large and precise values stay raw', () => {
  const values = [0, -3.14159, 128.00000001, 65.43822959731905];
  const file = fileWith(JSON.stringify({ classes: values.map((value) => ({ name: 'Same', maintainability: { maintainability_index: value } })) }));

  assert.deepEqual(file.classObservations, values.map((value) => ({ name: 'Same', maintainabilityRaw: value })));
});

for (const classes of ['null', '{}', '4', '"classes"', 'true']) {
  test(`Given native classes ${classes}, when a snapshot is built, then a path-specific diagnostic rejects the array`, () => {
    assert.throws(() => fileWith(`{"classes":${classes}}`), { message: 'Invalid class observation for src/value.ts at classes: expected an array.' });
  });
}

for (const entry of ['null', '[]', '4', '"Class"', 'true']) {
  test(`Given native class entry ${entry}, when a snapshot is built, then a path-specific diagnostic rejects the entry`, () => {
    assert.throws(() => fileWith(`{"classes":[{"name":"First"},${entry}]}`), { message: 'Invalid class observation for src/value.ts at classes[1]: expected an object.' });
  });
}

for (const entry of ['{}', '{"name":null}', '{"name":4}', '{"name":[]}', '{"name":{}}', '{"name":true}']) {
  test(`Given native class entry ${entry}, when a snapshot is built, then a path-specific diagnostic rejects the name`, () => {
    assert.throws(() => fileWith(`{"classes":[${entry}]}`), { message: 'Invalid class observation for src/value.ts at classes[0].name: expected a string.' });
  });
}

for (const maintainability of ['null', '[]', '4', '"65.43"', 'true']) {
  test(`Given native class maintainability ${maintainability}, when a snapshot is built, then a path-specific diagnostic rejects the parent`, () => {
    assert.throws(() => fileWith(`{"classes":[{"name":"Class","maintainability":${maintainability}}]}`), { message: 'Invalid class observation for src/value.ts at classes[0].maintainability: expected an object.' });
  });
}

for (const index of ['null', '[]', '{}', '"65.43"', 'true', '1e999', '-1e999']) {
  test(`Given native class MI ${index}, when a snapshot is built, then a path-specific diagnostic rejects the index`, () => {
    assert.throws(() => fileWith(`{"classes":[{"name":"Class","maintainability":{"maintainability_index":${index}}}]}`), { message: 'Invalid class observation for src/value.ts at classes[0].maintainability.maintainability_index: expected a finite number.' });
  });
}
