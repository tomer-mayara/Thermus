import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../../support/processes/module-paths.ts';
import type { GitRepository } from './git-repository.ts';

const { inputIdentityOf } = await import(new URL('provenance/inputs.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  inputIdentityOf(root: string): object;
};

export function verifiedCoverageFor<T extends object>(repository: GitRepository, report: T) {
  const commit = repository.git('rev-parse', 'HEAD').trim();
  return { ...report, commit, measurementVersion: 'own-characters-1', provenance: {
    ...inputIdentityOf(repository.root), status: 'verified', capturedCommit: commit,
    buildFingerprint: 'd'.repeat(64), captureManifestFingerprint: 'e'.repeat(64),
  } };
}
