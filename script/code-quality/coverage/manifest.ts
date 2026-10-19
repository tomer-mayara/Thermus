import * as scriptIdentity from './manifest-scripts.ts';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { join } from 'node:path';
import { fingerprintOf } from '../provenance/tree.ts';
import { inputIdentityIn } from '../provenance/read.ts';
import type { InputIdentity, VerifiedCoverageProvenance } from '../provenance/types.ts';
import * as json from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';

const captureManifestName = 'capture-manifest.json';
export type CaptureManifest = { readonly version: 1; readonly identity: InputIdentity; readonly capturedCommit: string; readonly buildFingerprint: string; readonly rawFingerprint: string; readonly scripts: ReturnType<typeof scriptIdentity.scriptIdentitiesOf> };
export function rawFingerprintOf(folder: string): string {
  const names = fs.readdirSync(folder).filter((name) => /^coverage-.*\.json$/.test(name));
  if (names.length === 0) throw new CommandError('The capture manifest has no raw V8 data.');
  return fingerprintOf(names.map((name) => [name, fs.readFileSync(join(folder, name))]));
}
export function readCaptureManifest(folder: string): { manifest: CaptureManifest; provenance: VerifiedCoverageProvenance } {
  const text = fs.readFileSync(join(folder, captureManifestName), 'utf8');
  const record = json.objectOf(json.jsonOf(text));
  const identity = inputIdentityIn(record.identity);
  const hashes = [record.buildFingerprint, record.rawFingerprint];
  if (record.version !== 1 || scriptIdentity.scriptIdentitiesIn(record.scripts) === undefined || identity === undefined || !hashes.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) throw new CommandError('The capture manifest is invalid.');
  if (typeof record.capturedCommit !== 'string' || !/^[a-f0-9]{40}$/.test(record.capturedCommit)) throw new CommandError('The capture manifest has no valid original commit.');
  const manifest = record as CaptureManifest;
  return { manifest, provenance: provenanceOf(manifest, text) };
}
export function writeCaptureManifest(folder: string, manifest: CaptureManifest): VerifiedCoverageProvenance {
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(join(folder, captureManifestName), text);
  return provenanceOf(manifest, text);
}
function provenanceOf(manifest: CaptureManifest, text: string): VerifiedCoverageProvenance {
  return { ...manifest.identity, status: 'verified', capturedCommit: manifest.capturedCommit, buildFingerprint: manifest.buildFingerprint, captureManifestFingerprint: createHash('sha256').update(text).digest('hex') };
}
