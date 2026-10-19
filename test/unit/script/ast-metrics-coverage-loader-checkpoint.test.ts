import assert from 'node:assert/strict';
import { copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { changeLoaderRecord, loaderCaptureIn } from './fixtures/loader-capture.ts';

const { assertCompleteCapture } = await import(new URL('coverage/completeness.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/coverage/completeness.ts');
type Capture = ReturnType<typeof loaderCaptureIn>;
const corruptions: readonly [string, (capture: Capture) => unknown][] = [
  ['empty list', () => []], ['non-array value', () => ({})],
  ['reordered files', ({ checkpoint }) => [...checkpoint].reverse()],
  ['duplicate file', ({ checkpoint }) => [checkpoint[0], checkpoint[0], checkpoint[1]]],
  ['wrong hash', ({ checkpoint }) => [{ ...checkpoint[0], hash: '0'.repeat(64) }, checkpoint[1]]],
  ['invalid hash', ({ checkpoint }) => [{ ...checkpoint[0], hash: 'not-a-hash' }, checkpoint[1]]],
  ['wrong process', ({ checkpoint }) => [{ ...checkpoint[0], name: 'coverage-43-100-1.json' }, checkpoint[1]]],
  ['wrong thread', ({ checkpoint }) => [{ ...checkpoint[0], name: 'coverage-42-100-0.json' }, checkpoint[1]]],
  ['noncanonical time', ({ checkpoint }) => [{ ...checkpoint[0], name: 'coverage-42-0100-1.json' }, checkpoint[1]]],
  ['unsafe time', ({ checkpoint }) => [{ ...checkpoint[0], name: 'coverage-42-9007199254740993-1.json' }, checkpoint[1]]],
  ['path escape', ({ checkpoint }) => [{ ...checkpoint[0], name: `../${checkpoint[0].name}` }, checkpoint[1]]],
  ['extra field', ({ checkpoint }) => [{ ...checkpoint[0], extra: true }, checkpoint[1]]],
  ['missing name', ({ checkpoint }) => [{ hash: checkpoint[0].hash }, checkpoint[1]]],
];

for (const [name, change] of corruptions) {
  test(`Given matching loader checkpoints with ${name}, when capture is checked, then agreement cannot make invalid raw proof complete`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    const checkpoint = change(capture);
    for (const field of ['marker', 'ack', 'receipt'] as const) changeLoaderRecord(folder, capture.files[field], { checkpoint });
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), /Incomplete captures are unverified/);
  });
}

test('Given a loader checkpoint and final file with the same timestamp, when capture is checked, then a filename alias is not a later V8 flush', (t) => {
  const folder = dataDirectory(t);
  const capture = loaderCaptureIn(folder);
  rmSync(join(folder, capture.final.name));
  copyFileSync(join(folder, capture.checkpoint[1].name), join(folder, 'coverage-42-0110-1.json'));
  assert.throws(() => assertCompleteCapture(folder, capture.protocol), /Incomplete captures are unverified/);
});

for (const name of ['coverage-042-130-1.json', 'coverage-42-130-01.json']) {
  test(`Given extra raw filename alias ${name}, when loader evidence is checked, then numeric coercion cannot hide an extra file`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    copyFileSync(join(folder, capture.final.name), join(folder, name));
    assert.throws(() => assertCompleteCapture(folder, capture.protocol), /Incomplete captures are unverified/);
  });
}
