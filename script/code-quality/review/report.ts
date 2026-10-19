import { CommandError } from '../shared/repository.ts';
import { reviewReportOf } from './schema.ts';

type ReviewRun = { readonly base: string; readonly status: number | null };
const severities = ['high', 'medium', 'low'];

export function reviewPassed(text: string, run: ReviewRun): boolean {
  const report = reviewReportOf(text, run.base);
  const countsAgree = severities.every((severity) => report.regressions.filter((finding) => finding.severity === severity).length === report.summary[severity]);
  const passed = report.summary.high === 0;
  const consistent = [countsAgree, report.improvements.length === report.summary.improvements, report.gate === (passed ? 'passed' : 'failed')];
  if (!consistent.every(Boolean)) throw new CommandError('ast-metrics review wrote inconsistent JSON.');
  if (run.status !== (passed ? 0 : 1)) throw new CommandError(`ast-metrics review returned an inconsistent exit status ${run.status}.`);
  return passed;
}
