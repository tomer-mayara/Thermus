import assert from 'node:assert/strict';
import { copyFileSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { changeLoaderRecord, loaderCaptureIn } from './fixtures/loader-capture.ts';

const script = pathToFileURL(astMetricsCoverageScript);
const { assertCompleteCapture } = await import(new URL('coverage/completeness.ts', script).href) as typeof import('../../../script/code-quality/coverage/completeness.ts');
const incomplete = /Incomplete captures are unverified/;

for (const threads of [{ threadId: 1, ownerThreadId: 0 }, { threadId: 3, ownerThreadId: 2 }]) {
  test(`Given acknowledged loader ${threads.threadId} with normal owner ${threads.ownerThreadId}, when capture is checked, then its intact checkpoint and later flush verify`, (t) => {
    const folder = dataDirectory(t);
    const { protocol } = loaderCaptureIn(folder, threads);
    assert.doesNotThrow(() => assertCompleteCapture(folder, protocol));
  });
}

for (const field of ['request', 'ack', 'receipt', 'owner', 'marker'] as const) {
  test(`Given a loader without its ${field}, when capture is checked, then its other evidence cannot complete it`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    rmSync(join(folder, capture.files[field]));
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), incomplete);
  });
}

for (const field of ['request', 'ack', 'receipt'] as const) {
  for (const change of [{ captureId: 'b'.repeat(64) }, { pid: 43 }, { threadId: 2 }, { ownerThreadId: 2 }, { nonce: '22345678-1234-1234-1234-123456789abc' }, { completionProtocol: 'normal-exit-or-sealed-1' }, { loaderProtocol: 'loader-unknown' }, { extra: true }]) {
    test(`Given a loader ${field} with mismatched ${Object.keys(change)[0]}, when capture is checked, then the proof is rejected`, (t) => {
      const folder = dataDirectory(t);
      const capture = loaderCaptureIn(folder);
      changeLoaderRecord(folder, capture.files[field], change);
      assert.throws(() => assertCompleteCapture(folder, capture.protocol), incomplete);
    });
  }
}

for (const change of [{ complete: true }, { complete: 0 }, { nonce: 'invalid' }, { ownerThreadId: 1 }, { ownerThreadId: -1 }, { ownerThreadId: 0.5 }]) {
  test(`Given invalid loader marker ${JSON.stringify(change)}, when capture is checked, then the marker cannot approve its thread`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    changeLoaderRecord(folder, capture.files.marker, change);
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), incomplete);
  });
}

for (const [field, state] of [['ack', 'requested'], ['receipt', 'timeout'], ['receipt', 'parked']] as const) {
  test(`Given loader ${field} state ${state}, when capture is checked, then later raw data cannot resurrect acknowledgement`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    changeLoaderRecord(folder, capture.files[field], { state });
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), incomplete);
  });
}

for (const change of [{ complete: false }, { state: 'running' }, { state: 'sealed-before-crash', complete: false }, { captureId: 'b'.repeat(64) }, { threadId: 5 }, { pid: 43 }]) {
  test(`Given invalid owner ${JSON.stringify(change)}, when a loader is checked, then its own handshake is insufficient`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    changeLoaderRecord(folder, capture.files.owner, change);
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), incomplete);
  });
}

for (const field of ['checkpoint', 'final', 'ownerFinal'] as const) {
  test(`Given missing loader ${field} raw evidence, when capture is checked, then verification fails`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    const file = field === 'checkpoint' ? capture.checkpoint[0] : capture[field];
    rmSync(join(folder, file.name));
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), incomplete);
  });
}

for (const field of ['marker', 'ack', 'receipt'] as const) {
  test(`Given a stale checkpoint in the loader ${field}, when capture is checked, then only exact checkpoint agreement verifies`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    changeLoaderRecord(folder, capture.files[field], { checkpoint: [capture.checkpoint[0]] });
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), incomplete);
  });
}

for (const mutation of ['changed checkpoint', 'extra earlier raw', 'extra later raw', 'earlier final', 'duplicate marker', 'duplicate receipt', 'untracked raw', 'malformed raw'] as const) {
  test(`Given ${mutation}, when loader evidence is checked, then it cannot become a complete capture`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    const final = join(folder, capture.final.name);
    if (mutation === 'changed checkpoint') writeFileSync(join(folder, capture.checkpoint[0].name), '{"changed":true}');
    if (mutation === 'extra earlier raw') copyFileSync(final, join(folder, 'coverage-42-105-1.json'));
    if (mutation === 'extra later raw') copyFileSync(final, join(folder, 'coverage-42-130-1.json'));
    if (mutation === 'earlier final') renameSync(final, join(folder, 'coverage-42-90-1.json'));
    if (mutation === 'duplicate marker') copyFileSync(join(folder, capture.files.marker), join(folder, 'process-copy.json'));
    if (mutation === 'duplicate receipt') copyFileSync(join(folder, capture.files.receipt), join(folder, 'loader-receipt-copy.json'));
    if (mutation === 'untracked raw') copyFileSync(final, join(folder, 'coverage-43-120-1.json'));
    if (mutation === 'malformed raw') copyFileSync(final, join(folder, 'coverage-42-unsafe-1.json'));
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), incomplete);
  });
}

test('Given loader evidence and a signal outcome, when the normal owner appears complete, then the existing pre-crash seal guard still rejects the signal death', (t) => {
  const folder = dataDirectory(t);
  const capture = loaderCaptureIn(folder);
  writeFileSync(join(folder, 'signal-owner.json'), JSON.stringify({ pid: 42, signal: 'SIGKILL', captureId: capture.protocol.captureId }));
  assert.throws(() => assertCompleteCapture(folder, capture.protocol), /without a verified pre-crash seal/);
});

test('Given a copied loader marker with no loader request files, when its state claims legacy completion, then the old protocol cannot approve it', (t) => {
  const folder = dataDirectory(t);
  const capture = loaderCaptureIn(folder);
  const legacy = { ...capture.protocol, completionProtocol: 'normal-exit-or-sealed-1' } as const;
  for (const file of Object.values(capture.files)) changeLoaderRecord(folder, file, legacy);
  assert.throws(() => assertCompleteCapture(folder, legacy), incomplete);
  changeLoaderRecord(folder, capture.files.marker, { complete: true });
  assert.throws(() => assertCompleteCapture(folder), incomplete);
});

test('Given intact loader evidence, when its marker JSON has another file name, then the filename does not replace actual identity validation', (t) => {
  const folder = dataDirectory(t);
  const capture = loaderCaptureIn(folder);
  const marker = JSON.parse(readFileSync(join(folder, capture.files.marker), 'utf8'));
  assert.equal(marker.threadId, 1);
  renameSync(join(folder, capture.files.marker), join(folder, 'process-999-0.json'));
  assert.doesNotThrow(() => assertCompleteCapture(folder, capture.protocol));
});

test('Given every loader record agrees on an invalid capture ID, when the proof is checked, then agreement does not make the identity valid', (t) => {
  const folder = dataDirectory(t);
  const capture = loaderCaptureIn(folder);
  const protocol = { ...capture.protocol, captureId: 'not-a-capture-hash' };
  for (const file of Object.values(capture.files)) changeLoaderRecord(folder, file, protocol);
  assert.throws(() => assertCompleteCapture(folder, protocol), incomplete);
});
