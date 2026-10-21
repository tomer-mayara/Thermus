import { changedPathsOf } from './changes.ts';
import { anyGlobMatches } from './globs.ts';
import type { MetricsFiles, ReviewFinding, StageOutcome } from './metrics-files.ts';
import type { Rules } from './rules.ts';
import type { Change, Reason } from './types.ts';

interface MetricsInput {
  readonly changes: readonly Change[];
  readonly metrics?: MetricsFiles;
}

interface MetricsOutcome {
  readonly reasons: Reason[];
  readonly lines: string[];
}

// A goal miss alone is no reason: the check applies the MI rules and the CRAP goals itself.
export function metricsOutcome(input: MetricsInput, rules: Pick<Rules, 'scopes'>): MetricsOutcome {
  if (input.metrics === undefined) return { reasons: [], lines: ['not checked: give --process and --review'] };
  const { outcomes, findings } = input.metrics;
  const review = findings === undefined
    ? { reasons: [], lines: ['findings not read: the Review stage did not complete'] }
    : findingOutcome(findings, changedPathsOf(input.changes), rules.scopes.production);
  return {
    reasons: [...outcomes.filter(incomplete).map(stageReason), ...review.reasons],
    lines: [...outcomes.map((outcome) => `${outcome.name}: ${outcome.status}`), ...review.lines],
  };
}

function incomplete(outcome: StageOutcome): boolean {
  return outcome.status === 'failed' || outcome.status === 'unavailable';
}

function stageReason(outcome: StageOutcome): Reason {
  return { route: 'FIX', key: 'required_checks', fact: `${outcome.name} ${outcome.status}` };
}

function findingOutcome(findings: readonly ReviewFinding[], changed: readonly string[], production: readonly string[]): MetricsOutcome {
  const high = findings.filter((finding) => finding.severity === 'high');
  const own = high.filter((finding) => changed.includes(finding.file));
  const ruled = (finding: ReviewFinding) => anyGlobMatches(production, finding.file);
  const text = (finding: ReviewFinding) => `${finding.file}: ${finding.message}`;
  const unchanged = high.length - own.length;
  return {
    reasons: own.filter(ruled).map((finding) => ({ route: 'READ', key: 'ratchet.review_findings', fact: text(finding) })),
    lines: [
      ...own.filter((finding) => !ruled(finding)).map((finding) => `outside scopes.production: ${text(finding)}`),
      `${unchanged} ${unchanged === 1 ? 'finding' : 'findings'} on unchanged files, reason unchanged by this PR`,
    ],
  };
}
