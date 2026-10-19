import * as scriptIdentity from './manifest-scripts.ts';
import { inputIdentityIn } from '../provenance/read.ts';
import type * as provenance from '../provenance/types.ts';
import * as protocol from './protocol.ts';
import * as json from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';

const supportedVersions = new Set([1, 2, 3, 4]);
export type CaptureManifest = { readonly version: 1 | 2 | 3 | 4; readonly completionProtocol?: protocol.CaptureProtocol['completionProtocol']; readonly captureId?: string; readonly identity: provenance.InputIdentity; readonly comparisonIdentity?: provenance.InputIdentity; readonly capturedCommit: string; readonly buildFingerprint: string; readonly rawFingerprint: string; readonly scripts: ReturnType<typeof scriptIdentity.scriptIdentitiesOf> };
export function manifestIn(record: json.JsonObject): CaptureManifest {
  const identity = inputIdentityIn(record.identity);
  const hashes = [record.buildFingerprint, record.rawFingerprint];
  const validVersion = supportedVersions.has(record.version as number);
  const validHashes = hashes.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash));
  if (!validVersion || !validHashes || identity === undefined || scriptIdentity.scriptIdentitiesIn(record.scripts) === undefined) throw new CommandError('The capture manifest is invalid.');
  if (record.version === 1 && identity.suite !== 'unit') throw new CommandError('The legacy capture manifest must name the unit suite.');
  if (typeof record.capturedCommit !== 'string' || !/^[a-f0-9]{40}$/.test(record.capturedCommit)) throw new CommandError('The capture manifest has no valid original commit.');
  return record as CaptureManifest;
}
export function assertComparisonIdentity(manifest: CaptureManifest): void {
  const comparison = inputIdentityIn(manifest.comparisonIdentity);
  if (comparison?.suite !== 'unit') throw new CommandError('The capture comparison identity is invalid.');
  const sameBasis = (['sourceFingerprint', 'runtime', 'compiler', 'measurementVersion'] as const).every((key) => comparison[key] === manifest.identity[key]);
  if (!sameBasis) throw new CommandError('The capture comparison identity is invalid.');
}
export function protocolOf(manifest: CaptureManifest): protocol.CaptureProtocol {
  const completionProtocol = manifest.version === 4 ? protocol.completionProtocol : protocol.legacyCompletionProtocol;
  if (manifest.completionProtocol !== completionProtocol || typeof manifest.captureId !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.captureId)) throw new CommandError('The capture completion protocol is invalid.');
  return { completionProtocol, captureId: manifest.captureId };
}
