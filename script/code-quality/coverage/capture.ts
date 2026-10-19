import { coverageOriginOf } from '../provenance/captures.ts';
import { inputIdentityOf } from '../provenance/inputs.ts';
import type { CoverageSuite } from '../provenance/types.ts';
import { assertBuild, assertInputs, preparedBuild } from './build.ts';
import { retainCapture } from './archive.ts';
import { rawFingerprintOf } from './manifest.ts';
import { scriptIdentitiesOf } from './manifest-scripts.ts';
import { sourceScriptsIn } from './input.ts';
import { mergedCoverage } from './merge.ts';
import { withSuiteCoverage } from './run.ts';
import { selectedSuites, suiteCommands } from './suites.ts';

export function collectCoverage(root: string, options: { commit: string; noBuild: boolean; suites?: readonly CoverageSuite[] }) {
  const suites = selectedSuites(options.suites);
  // Validate every selected package command before a build or suite can start.
  for (const suite of suites) suiteCommands(root, suite);
  const comparisonIdentity = inputIdentityOf(root);
  const buildFingerprint = preparedBuild(root, comparisonIdentity, options.noBuild);
  const verify = () => { assertInputs(root, comparisonIdentity); assertBuild(root, buildFingerprint); };
  const captures = suites.map((suite) => withSuiteCoverage(root, { suite, verify }, (raw) => {
    const identity = inputIdentityOf(root, suite);
    const rawFingerprint = rawFingerprintOf(raw);
    const coverage = mergedCoverage(sourceScriptsIn(raw, root));
    verify();
    const manifest = { version: 2, identity, comparisonIdentity, capturedCommit: options.commit, buildFingerprint, rawFingerprint, scripts: scriptIdentitiesOf(coverage) } as const;
    return retainCapture(root, raw, { manifest, verify });
  }));
  function* capturedProcesses() {
    for (const { folder } of captures) yield* sourceScriptsIn(folder, root);
  }
  const coverage = mergedCoverage(capturedProcesses());
  verify();
  const provenance = coverageOriginOf(captures.map(({ provenance }) => provenance), comparisonIdentity);
  return { coverage, commit: options.commit, provenance, suite: provenance.suite, folder: captures[0].folder, folders: captures.map(({ folder }) => folder), suites };
}
