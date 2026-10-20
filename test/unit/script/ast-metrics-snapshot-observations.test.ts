import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const invalid = { message: /^Invalid snapshot observations at /u };
const expected = { commit: 'a'.repeat(40), tool: 'ast-metrics 0.43.1' };
const document = (files: unknown = [{ path: 'src/value.ts' }]) => ({ version: 1, ...expected, files });
const read = async (value: unknown, binding = expected) => {
  const { snapshotObservationsIn } = await import(new URL('snapshot/observations.ts', pathToFileURL(astMetricsSnapshotScript)).href);
  return snapshotObservationsIn(JSON.stringify(value), binding);
};

test('Given raw numbers and unrelated data, when read, then the projection keeps finite precision and only raw observation fields', async () => {
  const values = [0, -3.14159, 128.00000001, 65.43822959731905];
  const files = values.map((maintainabilityRaw, index) => ({ path: `src/${index}.ts`, maintainabilityRaw, maintainability: 'ignored', classObservations: [{ name: '', maintainabilityRaw }, { name: 'Same' }, { name: 'Same' }], sourceEvidence: null }));
  assert.deepEqual(await read({ ...document(files), global: null }), { version: 1, ...expected, files: files.map(({ path, maintainabilityRaw, classObservations }) => ({ path, maintainabilityRaw, classObservations })) });
});

test('Given absent and empty observations, when read, then absence and empty arrays remain distinct without rounded fallback', async () => {
  assert.deepEqual((await read(document([{ path: 'src/a.ts', maintainability: 85 }, { path: 'src/b.ts', classObservations: [] }]))).files, [{ path: 'src/a.ts' }, { path: 'src/b.ts', classObservations: [] }]);
  assert.deepEqual((await read(document([]))).files, []);
});

for (const path of ['', 'src', 'src/', '/src/a.ts', 'C:/src/a.ts', 'lib/a.ts', 'src//a.ts', 'src/./a.ts', 'src/../a.ts', 'src/a/../../b.ts', 'src\\a.ts', 'src/a\u0000.ts', 'src/a\n.ts', 'src/\u007f.ts']) {
  test(`Given noncanonical path ${JSON.stringify(path)}, when read, then it is refused`, async () => { await assert.rejects(read(document([{ path }])), invalid); });
}
for (const files of [null, {}, 1, 'files', [null], [[]], [{}], [{ path: 2 }], [{ path: 'src/a.ts' }, { path: 'src/a.ts' }]]) {
  test(`Given malformed files ${JSON.stringify(files)}, when read, then it is refused`, async () => { await assert.rejects(read(document(files)), invalid); });
}
for (const raw of [null, '85', {}, [], true, 1e999, -1e999]) {
  test(`Given invalid raw MI ${JSON.stringify(raw)}, when read, then file and class fields are refused`, async () => {
    await assert.rejects(read(document([{ path: 'src/a.ts', maintainabilityRaw: raw }])), invalid);
    await assert.rejects(read(document([{ path: 'src/a.ts', classObservations: [{ name: 'A', maintainabilityRaw: raw }] }])), invalid);
  });
}
for (const classes of [null, {}, 1, 'classes', [null], [[]], [1], [{}], [{ name: null }], [{ name: 1 }], [{ name: [] }]]) {
  test(`Given malformed class wire fields ${JSON.stringify(classes)}, when read, then they are refused`, async () => { await assert.rejects(read(document([{ path: 'src/a.ts', classObservations: classes }])), invalid); });
}
for (const change of [{ version: 2 }, { version: '1' }, { commit: 'b'.repeat(40) }, { commit: 'A'.repeat(40) }, { tool: 'other' }, { tool: null }, { files: undefined }]) {
  test(`Given an invalid or mismatched envelope ${JSON.stringify(change)}, when read, then it is refused`, async () => { await assert.rejects(read({ ...document(), ...change }), invalid); });
}
for (const binding of [{ ...expected, commit: 'abc' }, { ...expected, commit: `${expected.commit}\n` }, { ...expected, commit: 'A'.repeat(40) }, { ...expected, tool: '' }, { ...expected, tool: '  ' }]) {
  test(`Given invalid expected binding ${JSON.stringify(binding)}, when read, then it is refused`, async () => { await assert.rejects(read({ ...document(), ...binding }, binding), invalid); });
}
test('Given invalid JSON or a nonobject root, when decoded, then it is refused synchronously', async () => {
  const { snapshotObservationsIn } = await import(new URL('snapshot/observations.ts', pathToFileURL(astMetricsSnapshotScript)).href);
  for (const text of ['', '{', 'null', '[]', '1', 'true']) assert.throws(() => snapshotObservationsIn(text, expected), invalid);
  for (const number of ['1e999', '-1e999']) {
    const envelope = JSON.stringify({ version: 1, ...expected }).slice(0, -1);
    const file = `[{"path":"src/a.ts","maintainabilityRaw":${number}}]`;
    const classes = `[{"path":"src/a.ts","classObservations":[{"name":"A","maintainabilityRaw":${number}}]}]`;
    assert.throws(() => snapshotObservationsIn(`${envelope},"files":${file}}`, expected), { message: 'Invalid snapshot observations at src/a.ts.maintainabilityRaw: expected a finite number.' });
    assert.throws(() => snapshotObservationsIn(`${envelope},"files":${classes}}`, expected), { message: 'Invalid snapshot observations at src/a.ts.classObservations[0].maintainabilityRaw: expected a finite number.' });
  }
});
