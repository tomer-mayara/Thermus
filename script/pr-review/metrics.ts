import { changedPathsOf } from './changes.ts';
import { anyGlobMatches } from './globs.ts';
import type { MetricsFiles, ReviewFinding, StageOutcome } from './metrics-files.ts';
import type { Rules } from './rules.ts';
import { signalsOf } from './signals.ts';
import type { Change, Reason } from './types.ts';

const findingKeys = { T1: 'ratchet.review_findings', note: 'ratchet.review_findings_high' };

interface MetricsInput {
  readonly changes: readonly Change[];
  readonly metrics?: MetricsFiles;
}

interface MetricsOutcome {
  readonly reasons: Reason[];
  readonly lines: string[];
  readonly notes: string[];
}

// A goal miss alone is no reason: the check applies the MI rules and the CRAP goals itself.
export function metricsOutcome(input: MetricsInput, rules: Pick<Rules, 'scopes' | 'reviewFindingsHigh'>): MetricsOutcome {
  if (input.metrics === undefined) return { reasons: [], lines: ['not checked: give --process and --review'], notes: [] };
  const { outcomes, findings } = input.metrics;
  const review = findings === undefined
    ? { reasons: [], lines: ['findings not read: the Review stage did not complete'], notes: [] }
    : findingOutcome(findings, changedPathsOf(input.changes), rules);
  return {
    reasons: [...outcomes.filter(incomplete).map(stageReason), ...review.reasons],
    lines: [...outcomes.map((outcome) => `${outcome.name}: ${outcome.status}`), ...review.lines],
    notes: review.notes,
  };
}

function incomplete(outcome: StageOutcome): boolean {
  return outcome.status === 'failed' || outcome.status === 'unavailable';
}

function stageReason(outcome: StageOutcome): Reason {
  return { blocking: true, key: 'required_checks', fact: `${outcome.name} ${outcome.status}` };
}

// A retained high finding on a changed production file follows ratchet.review_findings_high.
function findingOutcome(findings: readonly ReviewFinding[], changed: readonly string[], rules: Pick<Rules, 'scopes' | 'reviewFindingsHigh'>): MetricsOutcome {
  const high = findings.filter((finding) => finding.severity === 'high');
  const own = high.filter((finding) => changed.includes(finding.file));
  const ruled = (finding: ReviewFinding) => anyGlobMatches(rules.scopes.production, finding.file);
  const text = (finding: ReviewFinding) => `${finding.file}: ${finding.message}`;
  const unchanged = high.length - own.length;
  const retained = signalsOf(rules.reviewFindingsHigh, findingKeys, own.filter(ruled).map(text));
  return {
    reasons: retained.reasons,
    lines: [
      ...own.filter((finding) => !ruled(finding)).map((finding) => `outside scopes.production: ${text(finding)}`),
      `${unchanged} ${unchanged === 1 ? 'finding' : 'findings'} on unchanged files, reason unchanged by this PR`,
    ],
    notes: retained.notes,
  };
}
