import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { InputIdentity } from '../../../script/code-quality/provenance/types.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { changeLoaderRecord, loaderCaptureIn } from './fixtures/loader-capture.ts';

const script = pathToFileURL(astMetricsCoverageScript);
const { readCaptureManifest, rawFingerprintOf } = await import(new URL('coverage/manifest.ts', script).href) as typeof import('../../../script/code-quality/coverage/manifest.ts');
const { coverageProvenanceIn } = await import(new URL('provenance/read.ts', script).href) as typeof import('../../../script/code-quality/provenance/read.ts');
const identity: InputIdentity = { sourceFingerprint: 'b'.repeat(64), inputsFingerprint: 'c'.repeat(64), runtime: 'node-24.20.0', compiler: 'typescript-7.0.2', measurementVersion: 'own-characters-1', suite: 'unit' };

function writeManifest(folder: string, change: Record<string, unknown> = {}): void {
  const manifest = { version: 4, completionProtocol: 'normal-exit-or-sealed-or-loader-1', captureId: 'a'.repeat(64), identity, comparisonIdentity: identity, capturedCommit: 'd'.repeat(40), buildFingerprint: 'e'.repeat(64), rawFingerprint: rawFingerprintOf(folder), scripts: [{ path: 'src/a.ts', representation: 'emitted-javascript', contentIdentity: 'f'.repeat(64) }], ...change };
  writeFileSync(join(folder, 'capture-manifest.json'), JSON.stringify(manifest));
}

test('Given a v4 loader archive, when its manifest and provenance are read, then the original protocol and capture identity remain verified', (t) => {
  const folder = dataDirectory(t);
  const capture = loaderCaptureIn(folder);
  writeManifest(folder);
  const { manifest, provenance } = readCaptureManifest(folder);
  assert.equal(manifest.version, 4);
  assert.equal(provenance.completionProtocol, capture.protocol.completionProtocol);
  assert.equal(provenance.captureId, capture.protocol.captureId);
  assert.deepEqual(coverageProvenanceIn(provenance), provenance);
});

for (const field of ['request', 'ack', 'receipt'] as const) {
  test(`Given a loader ${field}, when its evidence changes, then the raw capture fingerprint changes`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    const original = rawFingerprintOf(folder);
    changeLoaderRecord(folder, capture.files[field], { nonce: '22345678-1234-1234-1234-123456789abc' });
    assert.notEqual(rawFingerprintOf(folder), original);
  });
}

for (const version of [1, 2, 3]) {
  test(`Given unchanged legacy v${version} normal evidence, when its archive is read, then its original validation contract remains supported`, (t) => {
    const folder = dataDirectory(t);
    const capture = loaderCaptureIn(folder);
    for (const file of [capture.files.marker, capture.files.request, capture.files.ack, capture.files.receipt, ...capture.checkpoint.map(({ name }) => name), capture.final.name]) rmSync(join(folder, file));
    const legacy = { completionProtocol: 'normal-exit-or-sealed-1', captureId: capture.protocol.captureId };
    changeLoaderRecord(folder, capture.files.owner, legacy);
    writeManifest(folder, { version, ...(version === 3 ? legacy : { completionProtocol: undefined, captureId: undefined }) });
    const { manifest, provenance } = readCaptureManifest(folder);
    assert.equal(manifest.version, version);
    assert.equal(provenance.completionProtocol, version === 3 ? legacy.completionProtocol : undefined);
    assert.deepEqual(coverageProvenanceIn(provenance), provenance);
  });

  test(`Given loader evidence relabeled as a v${version} archive, when read, then the legacy protocol cannot approve a loader participant`, (t) => {
    const folder = dataDirectory(t);
    loaderCaptureIn(folder);
    writeManifest(folder, { version, completionProtocol: 'normal-exit-or-sealed-1' });
    assert.throws(() => readCaptureManifest(folder), /Incomplete captures are unverified|completion protocol/);
  });
}

for (const change of [{ version: 3 }, { completionProtocol: 'normal-exit-or-sealed-1' }, { completionProtocol: 'normal-exit-or-sealed-or-loader-2' }, { captureId: 'invalid' }]) {
  test(`Given a v4 capture with mismatched ${JSON.stringify(change)}, when its manifest is read, then version and protocol cannot be mixed`, (t) => {
    const folder = dataDirectory(t);
    loaderCaptureIn(folder);
    writeManifest(folder, change);
    assert.throws(() => readCaptureManifest(folder), /completion protocol/);
  });
}
