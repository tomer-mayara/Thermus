import { coverageOriginOf } from '../provenance/captures.ts';
import { inputIdentityOf } from '../provenance/inputs.ts';
import type { CoverageSuite } from '../provenance/types.ts';
import * as build from './build.ts';
import { sourceScriptsIn } from './input.ts';
import { mergedCoverage } from './merge.ts';
import * as selection from './suites.ts';
import { captureSuite } from './suite-capture.ts';

export function collectCoverage(root: string, options: { commit: string; noBuild: boolean; suites?: readonly CoverageSuite[] }) {
  const suites = selection.selectedSuites(options.suites);
  // Validate every selected package command before a build or suite can start.
  for (const suite of suites) selection.suiteCommands(root, suite);
  const comparisonIdentity = inputIdentityOf(root);
  const buildFingerprint = build.preparedBuild(root, comparisonIdentity, options.noBuild);
  const verify = () => { build.assertInputs(root, comparisonIdentity); build.assertBuild(root, buildFingerprint); };
  const captures = suites.map((suite) => captureSuite(root, suite, { commit: options.commit, comparisonIdentity, buildFingerprint, verify }));
  function* capturedProcesses() {
    for (const { folder } of captures) yield* sourceScriptsIn(folder, root);
  }
  const coverage = mergedCoverage(capturedProcesses());
  verify();
  const provenance = coverageOriginOf(captures.map(({ provenance }) => provenance), comparisonIdentity);
  return { coverage, commit: options.commit, provenance, suite: provenance.suite, folder: captures[0].folder, folders: captures.map(({ folder }) => folder), suites };
}
