import { inputIdentityOf } from '../provenance/inputs.ts';
import { assertBuild, assertInputs, preparedBuild } from './build.ts';
import { retainCapture } from './archive.ts';
import { rawFingerprintOf } from './manifest.ts';
import { scriptIdentitiesOf } from './manifest-scripts.ts';
import { sourceScriptsIn } from './input.ts';
import { mergedCoverage } from './merge.ts';
import { withUnitSuiteCoverage } from './run.ts';

export function collectCoverage(root: string, options: { commit: string; noBuild: boolean }) {
  const identity = inputIdentityOf(root);
  const buildFingerprint = preparedBuild(root, identity, options.noBuild);
  const verify = () => { assertInputs(root, identity); assertBuild(root, buildFingerprint); };
  return withUnitSuiteCoverage(root, (raw) => {
    const rawFingerprint = rawFingerprintOf(raw);
    const coverage = mergedCoverage(sourceScriptsIn(raw, root));
    verify();
    const manifest = { version: 1, identity, capturedCommit: options.commit, buildFingerprint, rawFingerprint, scripts: scriptIdentitiesOf(coverage) } as const;
    return { coverage, commit: options.commit, ...retainCapture(root, raw, { manifest, verify }) };
  }, verify);
}
