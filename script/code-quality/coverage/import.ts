import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoverageProvenance } from '../provenance/types.ts';
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
  build.assertBuild(root, capture.manifest.buildFingerprint);
  if (manifest.rawFingerprintOf(folder) !== capture.manifest.rawFingerprint) throw new CommandError('The capture manifest does not match the raw V8 data.');
  return capture;
}
export function importedCoverage(root: string, options: { folder: string; allowUnverified: boolean }) {
  const original = originalIn(options.folder);
  let provenance = importProvenance(root, options, original);
  const coverage = mergedCoverage(sourceScriptsIn(options.folder, root));
  if (provenance.status === 'verified') provenance = finalProvenance(root, { folder: options.folder, allowUnverified: options.allowUnverified, provenance, coverage, original });
  const commit = provenance.status === 'verified' ? provenance.capturedCommit : objectOf(original).capturedCommit;
  return { coverage, provenance, commit: typeof commit === 'string' && /^[a-f0-9]{40}$/.test(commit) ? commit : null };
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
