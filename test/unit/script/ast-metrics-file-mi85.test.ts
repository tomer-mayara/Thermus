import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const expected = { commit: 'a'.repeat(40), tool: '0.43.1' };
const snapshot = (files: readonly object[]) => JSON.stringify({ version: 1, ...expected, files });
const moduleUrl = new URL('assessment/file-mi85.ts', pathToFileURL(astMetricsSnapshotScript)).href;

for (const [raw, state] of [[84.96, 'LOW'], [85, 'MEETS'], [0, 'LOW'], [-4.25, 'LOW'], [128.00000001, 'MEETS']] as const) {
  test(`Given raw file MI ${raw}, when assessed, then it is ${state} with the exact observation`, async () => {
    const { fileMi85Of } = await import(moduleUrl);
    assert.deepEqual(fileMi85Of(snapshot([{ path: 'src/a.ts', maintainabilityRaw: raw, maintainability: 85 }]), expected, ['src/a.ts']), [{ path: 'src/a.ts', state, maintainabilityRaw: raw, reason: state === 'LOW' ? 'Raw file MI is below 85.' : 'Raw file MI is at least 85.' }]);
  });
}

test('Given missing rows and missing raw fields, when selected, then the reasons differ and display values supply no raw fallback', async () => {
  const { fileMi85Of } = await import(moduleUrl);
  assert.deepEqual(fileMi85Of(snapshot([{ path: 'src/a.ts', maintainability: 90, classObservations: [{ name: 'A', maintainabilityRaw: 95 }] }]), expected, ['src/a.ts', 'src/missing.ts']), [
    { path: 'src/a.ts', state: 'UNKNOWN', reason: 'The snapshot row has no raw file MI.' },
    { path: 'src/missing.ts', state: 'UNKNOWN', reason: 'The snapshot has no row for this file.' },
  ]);
});

test('Given a selected subset in a different order, when assessed, then only those files appear in requested order', async () => {
  const { fileMi85Of } = await import(moduleUrl);
  assert.deepEqual(fileMi85Of(snapshot([{ path: 'src/a.ts', maintainabilityRaw: 0 }, { path: 'src/b.ts', maintainabilityRaw: 90 }, { path: 'src/c.ts', maintainabilityRaw: 100 }]), expected, ['src/c.ts', 'src/a.ts']), [
    { path: 'src/c.ts', state: 'MEETS', maintainabilityRaw: 100, reason: 'Raw file MI is at least 85.' },
    { path: 'src/a.ts', state: 'LOW', maintainabilityRaw: 0, reason: 'Raw file MI is below 85.' },
  ]);
  assert.deepEqual(fileMi85Of(snapshot([]), expected, []), []);
});

for (const selected of [null, {}, 'src/a.ts', [null], [1], [''], ['src'], ['src/'], ['/src/a.ts'], ['C:/src/a.ts'], ['lib/a.ts'], ['src//a.ts'], ['src/./a.ts'], ['src/../a.ts'], ['src\\a.ts'], ['src/a\u0000.ts'], ['src/a\n.ts'], ['src/\u007f.ts'], ['src/\u0085.ts'], ['src/a.ts', 'src/a.ts']]) {
  test(`Given invalid selection ${JSON.stringify(selected)}, when assessed, then it is rejected`, async () => {
    const { fileMi85Of } = await import(moduleUrl);
    assert.throws(() => fileMi85Of(snapshot([]), expected, selected), { message: /^Invalid file MI85 selection at /u });
  });
}

for (const [field, patch] of [['version', { version: 2 }], ['commit', { commit: 'b'.repeat(40) }], ['tool', { tool: 'other' }], ['files', { files: null }]] as const) {
  test(`Given invalid snapshot ${field}, when the selection is empty, then decoding still rejects the snapshot`, async () => {
    const { fileMi85Of } = await import(moduleUrl);
    const text = JSON.stringify({ version: 1, ...expected, files: [], ...patch });
    assert.throws(() => fileMi85Of(text, expected, []), { message: new RegExp(`^Invalid snapshot observations at ${field}:`, 'u') });
  });
}

for (const selected of [[], ['src/a.ts']]) {
  test(`Given malformed unselected raw MI, when selection is ${JSON.stringify(selected)}, then complete decoding rejects the bad row`, async () => {
    const { fileMi85Of } = await import(moduleUrl);
    const text = snapshot([{ path: 'src/a.ts', maintainabilityRaw: 90 }, { path: 'src/b.ts', maintainabilityRaw: '85' }]);
    assert.throws(() => fileMi85Of(text, expected, selected), { message: 'Invalid snapshot observations at src/b.ts.maintainabilityRaw: expected a finite number.' });
  });
}

test('Given malformed JSON or expected binding, when assessed, then the existing decoder diagnostic is preserved', async () => {
  const { fileMi85Of } = await import(moduleUrl);
  assert.throws(() => fileMi85Of('{', expected, []), { message: 'Invalid snapshot observations at snapshot: expected an object.' });
  assert.throws(() => fileMi85Of(snapshot([]), { ...expected, commit: 'HEAD' }, []), { message: 'Invalid snapshot observations at expected.commit: expected a full lowercase commit SHA.' });
});

test('Given a sparse selection, when assessed, then the missing requested entry is rejected', async () => {
  const { fileMi85Of } = await import(moduleUrl);
  assert.throws(() => fileMi85Of(snapshot([]), expected, Array(1)), { message: 'Invalid file MI85 selection at selected[0]: expected a canonical src/ path.' });
});
