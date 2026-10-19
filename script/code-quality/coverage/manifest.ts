import * as scriptIdentity from './manifest-scripts.ts';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { join } from 'node:path';
import { fingerprintOf } from '../provenance/tree.ts';
import { inputIdentityIn } from '../provenance/read.ts';
import type { InputIdentity, VerifiedCoverageProvenance } from '../provenance/types.ts';
import { assertCompleteCapture } from './completeness.ts';
import * as json from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';

const captureManifestName = 'capture-manifest.json';
export type CaptureManifest = { readonly version: 1 | 2; readonly identity: InputIdentity; readonly comparisonIdentity?: InputIdentity; readonly capturedCommit: string; readonly buildFingerprint: string; readonly rawFingerprint: string; readonly scripts: ReturnType<typeof scriptIdentity.scriptIdentitiesOf> };
export function rawFingerprintOf(folder: string): string {
  const names = fs.readdirSync(folder).filter((name) => /^(coverage|process)-.*\.json$/.test(name));
  if (!names.some((name) => name.startsWith('coverage-'))) throw new CommandError('The capture manifest has no raw V8 data.');
  return fingerprintOf(names.map((name) => [name, fs.readFileSync(join(folder, name))]));
}
export function readCaptureManifest(folder: string): { manifest: CaptureManifest; provenance: VerifiedCoverageProvenance } {
  const text = fs.readFileSync(join(folder, captureManifestName), 'utf8');
  const record = json.objectOf(json.jsonOf(text));
  const manifest = manifestIn(record);
  if (manifest.version === 2) {
    assertComparisonIdentity(manifest);
    assertCompleteCapture(folder);
  }
  return { manifest, provenance: provenanceOf(manifest, text) };
}
function manifestIn(record: json.JsonObject): CaptureManifest {
  const identity = inputIdentityIn(record.identity);
  const hashes = [record.buildFingerprint, record.rawFingerprint];
  const validVersion = record.version === 1 || record.version === 2;
  const validHashes = hashes.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash));
  if (!validVersion || !validHashes || identity === undefined || scriptIdentity.scriptIdentitiesIn(record.scripts) === undefined) throw new CommandError('The capture manifest is invalid.');
  if (record.version === 1 && identity.suite !== 'unit') throw new CommandError('The legacy capture manifest must name the unit suite.');
  if (typeof record.capturedCommit !== 'string' || !/^[a-f0-9]{40}$/.test(record.capturedCommit)) throw new CommandError('The capture manifest has no valid original commit.');
  return record as CaptureManifest;
}
function assertComparisonIdentity(manifest: CaptureManifest): void {
  const comparison = inputIdentityIn(manifest.comparisonIdentity);
  if (comparison?.suite !== 'unit') throw new CommandError('The capture comparison identity is invalid.');
  const sameBasis = (['sourceFingerprint', 'runtime', 'compiler', 'measurementVersion'] as const).every((key) => comparison[key] === manifest.identity[key]);
  if (!sameBasis) throw new CommandError('The capture comparison identity is invalid.');
}
export function writeCaptureManifest(folder: string, manifest: CaptureManifest): VerifiedCoverageProvenance {
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(join(folder, captureManifestName), text);
  return provenanceOf(manifest, text);
}
function provenanceOf(manifest: CaptureManifest, text: string): VerifiedCoverageProvenance {
  return { ...manifest.identity, ...(manifest.comparisonIdentity === undefined ? {} : { comparisonIdentity: manifest.comparisonIdentity }), status: 'verified', capturedCommit: manifest.capturedCommit, buildFingerprint: manifest.buildFingerprint, captureManifestFingerprint: createHash('sha256').update(text).digest('hex') };
}
