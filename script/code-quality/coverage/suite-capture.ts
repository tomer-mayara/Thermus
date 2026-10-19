import * as inputs from '../provenance/inputs.ts';
import type * as provenance from '../provenance/types.ts';
import { retainCapture } from './archive.ts';
import * as protocol from './protocol.ts';
import { rawFingerprintOf } from './manifest.ts';
import { scriptIdentitiesOf } from './manifest-scripts.ts';
import { sourceScriptsIn } from './input.ts';
import { mergedCoverage } from './merge.ts';
import { withSuiteCoverage } from './run.ts';

type CaptureSession = { readonly commit: string; readonly comparisonIdentity: provenance.InputIdentity; readonly buildFingerprint: string; readonly verify: () => void };
export function captureSuite(root: string, suite: provenance.CoverageSuite, session: CaptureSession) {
  const { comparisonIdentity, buildFingerprint, verify } = session;
  return withSuiteCoverage(root, { suite, verify }, (raw) => {
    const identity = inputs.inputIdentityOf(root, suite);
    const rawFingerprint = rawFingerprintOf(raw);
    const coverage = mergedCoverage(sourceScriptsIn(raw, root));
    verify();
    const manifest = { version: 4, completionProtocol: protocol.completionProtocol, captureId: protocol.captureIdOf(raw), identity, comparisonIdentity, capturedCommit: session.commit, buildFingerprint, rawFingerprint, scripts: scriptIdentitiesOf(coverage) } as const;
    return retainCapture(root, raw, { manifest, verify });
  });
}
