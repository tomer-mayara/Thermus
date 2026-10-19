import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { join } from 'node:path';
import { fingerprintOf } from '../provenance/tree.ts';
import type * as provenance from '../provenance/types.ts';
import { assertCompleteCapture } from './completeness.ts';
import * as json from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import * as format from './manifest-format.ts';
export type { CaptureManifest } from './manifest-format.ts';

const captureManifestName = 'capture-manifest.json';

export function rawFingerprintOf(folder: string): string {
  const names = fs.readdirSync(folder).filter((name) => /^(coverage|process|seal-request|seal-receipt|signal)-.*\.json$/.test(name));
  if (!names.some((name) => name.startsWith('coverage-'))) throw new CommandError('The capture manifest has no raw V8 data.');
  return fingerprintOf(names.map((name) => [name, fs.readFileSync(join(folder, name))]));
}
export function readCaptureManifest(folder: string): { manifest: format.CaptureManifest; provenance: provenance.VerifiedCoverageProvenance } {
  const text = fs.readFileSync(join(folder, captureManifestName), 'utf8');
  const record = json.objectOf(json.jsonOf(text));
  const manifest = format.manifestIn(record);
  if (manifest.version !== 1) {
    format.assertComparisonIdentity(manifest);
    assertCompleteCapture(folder, manifest.version === 3 ? format.protocolOf(manifest) : undefined);
  }
  return { manifest, provenance: provenanceOf(manifest, text) };
}
export function writeCaptureManifest(folder: string, manifest: format.CaptureManifest): provenance.VerifiedCoverageProvenance {
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(join(folder, captureManifestName), text);
  return provenanceOf(manifest, text);
}
function provenanceOf(manifest: format.CaptureManifest, text: string): provenance.VerifiedCoverageProvenance {
  return { ...manifest.identity, ...(manifest.version === 3 ? format.protocolOf(manifest) : {}), ...(manifest.comparisonIdentity === undefined ? {} : { comparisonIdentity: manifest.comparisonIdentity }), status: 'verified', capturedCommit: manifest.capturedCommit, buildFingerprint: manifest.buildFingerprint, captureManifestFingerprint: createHash('sha256').update(text).digest('hex') };
}
