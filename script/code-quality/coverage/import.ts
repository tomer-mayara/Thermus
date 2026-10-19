import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverageOriginOf } from '../provenance/captures.ts';
import type { CoverageProvenance, CoverageSuite } from '../provenance/types.ts';
import { inputIdentityIn } from '../provenance/read.ts';
import { objectOf } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import * as build from './build.ts';
import * as manifest from './manifest.ts';
import { scriptIdentitiesOf } from './manifest-scripts.ts';
import { sourceScriptsIn } from './input.ts';
import { mergedCoverage } from './merge.ts';

function verifiedOrigin(root: string, folder: string) {
  const capture = manifest.readCaptureManifest(folder);
  build.assertInputs(root, capture.manifest.identity);
  if (capture.manifest.comparisonIdentity !== undefined) build.assertInputs(root, capture.manifest.comparisonIdentity);
  build.assertBuild(root, capture.manifest.buildFingerprint);
  if (manifest.rawFingerprintOf(folder) !== capture.manifest.rawFingerprint) throw new CommandError('The capture manifest does not match the raw V8 data.');
  return capture;
}
export function importedCoverage(root: string, options: { folder: string; allowUnverified: boolean }) {
  const original = originalIn(options.folder);
  const initial = importProvenance(root, options, original);
  const coverage = mergedCoverage(sourceScriptsIn(options.folder, root));
  const provenance = initial.status === 'verified'
    ? selectedOriginOf(finalProvenance(root, { ...options, provenance: initial, coverage, original })) : initial;
  return { coverage, provenance, ...reportOriginOf(provenance, original) };
}
function selectedOriginOf(provenance: CoverageProvenance): CoverageProvenance {
  if (provenance.status !== 'verified') return provenance;
  if (provenance.suite === 'unit' || provenance.comparisonIdentity === undefined) return provenance;
  return coverageOriginOf([provenance], provenance.comparisonIdentity);
}
function reportOriginOf(provenance: CoverageProvenance, original: unknown): { commit: string | null; suite: CoverageSuite | readonly CoverageSuite[] | undefined } {
  if (provenance.status === 'verified') return { commit: provenance.capturedCommit, suite: provenance.suite };
  const record = objectOf(original);
  const originalSuite = inputIdentityIn(record.identity)?.suite;
  const suite = originalSuite === undefined || originalSuite === 'unit' ? originalSuite : [originalSuite];
  const commit = typeof record.capturedCommit === 'string' && /^[a-f0-9]{40}$/.test(record.capturedCommit) ? record.capturedCommit : null;
  return { commit, suite };
}
function importProvenance(root: string, options: { folder: string; allowUnverified: boolean }, original: unknown): CoverageProvenance {
  try { return verifiedOrigin(root, options.folder).provenance; }
  catch (error) {
    const reason = `Cannot verify the original capture manifest: ${error instanceof Error ? error.message : String(error)}`;
    if (!options.allowUnverified) throw new CommandError(reason);
    return { status: 'unverified', reason, original };
  }
}
function finalProvenance(root: string, state: { folder: string; allowUnverified: boolean; provenance: CoverageProvenance; coverage: ReturnType<typeof mergedCoverage>; original: unknown }): CoverageProvenance {
  try {
    const final = verifiedOrigin(root, state.folder);
    if (JSON.stringify(scriptIdentitiesOf(state.coverage)) !== JSON.stringify(final.manifest.scripts)) throw new CommandError('The identified scripts do not match the capture manifest.');
    if (final.provenance.captureManifestFingerprint !== objectOf(state.provenance).captureManifestFingerprint) throw new CommandError('The capture manifest changed during import.');
    return final.provenance;
  } catch (error) {
    const reason = `Cannot verify the original capture manifest: ${error instanceof Error ? error.message : String(error)}`;
    if (!state.allowUnverified) throw new CommandError(reason);
    return { status: 'unverified', reason, original: state.original };
  }
}
function originalIn(folder: string): unknown {
  let text: string;
  try { text = readFileSync(join(folder, 'capture-manifest.json'), 'utf8'); }
  catch { return undefined; }
  try { return JSON.parse(text); } catch { return text; }
}
