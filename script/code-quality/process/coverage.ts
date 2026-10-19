import { join, resolve } from 'node:path';
import { coverageForHead } from '../architecture/coverage-compatibility.ts';
import { coverageOfRepository } from '../architecture/coverage.ts';
import { collectCoverage } from '../coverage/capture.ts';
import { writeCoverageReport } from '../coverage/report.ts';
import { inputIdentityOf } from '../provenance/inputs.ts';
import { git } from '../shared/repository.ts';
import type { CoverageChoice, ProcessOptions } from './types.ts';

export function resolveProcessCoverage(root: string, options: ProcessOptions, required: boolean): CoverageChoice {
  if (options.skipCoverage) return { required, notice: 'Coverage was skipped with --skip-coverage. Architecture bands are withheld.' };
  const file = options.coverage === undefined ? join(root, 'ast-report', 'coverage.json') : resolve(options.coverage);
  if (options.collectCoverage) {
    const commit = git(root, ['rev-parse', 'HEAD'], 'Cannot read HEAD.').trim();
    const result = collectCoverage(root, { commit, noBuild: false });
    writeCoverageReport(file, { commit: result.commit, provenance: result.provenance }, result.coverage);
  }
  const supplied = coverageOfRepository(root, options.coverage === undefined ? undefined : file);
  const selected = coverageForHead(supplied, inputIdentityOf(root));
  if (selected.coverage === undefined) return { required, notice: selected.coverageNotice ?? 'Coverage is unavailable.' };
  return { file, required, notice: options.collectCoverage ? 'Collected verified compatible unit coverage.' : 'Reused verified compatible unit coverage.' };
}
