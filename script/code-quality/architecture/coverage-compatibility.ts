import type { CoverageReport } from './coverage.ts';
import type { InputIdentity } from '../provenance/types.ts';

interface CoverageSelection {
  readonly coverage?: CoverageReport;
  readonly coverageNotice?: string;
}

const missingCoverage = 'No coverage report: the bands are withheld. Run the coverage command when the test selection permits it.';
const skippedCoverage = 'Coverage was skipped with --no-coverage: the bands are withheld.';

// Only the analyzed head can establish compatibility. Its commit may follow a prose-only change.
export function coverageForHead(report: CoverageReport | undefined, head: InputIdentity | undefined, skip = false): CoverageSelection {
  if (skip) return { coverageNotice: skippedCoverage };
  if (report === undefined) return { coverageNotice: missingCoverage };
  const provenance = report.provenance;
  if (provenance?.status !== 'verified') return { coverageNotice: 'The coverage report has no verified provenance: the bands are withheld.' };
  if (head === undefined) return { coverageNotice: 'The head snapshot has no verified provenance: the bands are withheld.' };
  if (!compatible(report, head)) {
    return { coverageNotice: `The coverage report is of another tree (${provenance.capturedCommit.slice(0, 8)}): the bands are withheld. Run the coverage command again when the test selection permits it.` };
  }
  return { coverage: report };
}

function compatible(report: CoverageReport, head: InputIdentity): boolean {
  const provenance = report.provenance;
  if (provenance?.status !== 'verified') return false;
  if (report.commit !== provenance.capturedCommit || JSON.stringify(report.suite) !== JSON.stringify(provenance.suite) || report.measurementVersion !== head.measurementVersion) return false;
  const comparison = provenance.comparisonIdentity ?? provenance;
  return (['sourceFingerprint', 'inputsFingerprint', 'runtime', 'compiler', 'measurementVersion', 'suite'] as const)
    .every((key) => comparison[key] === head[key]);
}

// Missing data has a Markdown explanation; stale or skipped data also gets a command diagnostic.
export function coverageDiagnosticOf({ coverageNotice }: CoverageSelection): string | undefined {
  return coverageNotice === missingCoverage ? undefined : coverageNotice;
}
