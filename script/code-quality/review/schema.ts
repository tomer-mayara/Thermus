import { jsonOf, objectOf, textOf, type JsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';

interface ReviewReport {
  readonly summary: JsonObject;
  readonly regressions: readonly JsonObject[];
  readonly improvements: readonly JsonObject[];
  readonly gate: unknown;
}

const severities = ['high', 'medium', 'low'];
const counts = ['filesChanged', 'filesAdded', 'filesDeleted', ...severities, 'improvements'];

function isCommit(value: unknown): boolean {
  return /^[a-f0-9]{40}$/u.test(textOf(value) ?? '');
}

function isCount(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validFindings(value: unknown, kind: string): boolean {
  return Array.isArray(value) && value.every((entry: unknown) => {
    const finding = objectOf(entry);
    return finding.kind === kind && severities.includes(textOf(finding.severity) ?? '') && ['rule', 'file', 'message'].every((key) => Boolean(textOf(finding[key])));
  });
}

export function reviewReportOf(text: string, base: string): ReviewReport {
  const report = objectOf(jsonOf(text)), summary = objectOf(report.summary);
  const valid = [
    report.methodologyVersion === '1.1', report.baseRef === base,
    [report.baseSha, report.headSha].every(isCommit), counts.map((key) => summary[key]).every(isCount),
    validFindings(report.regressions, 'regression'), validFindings(report.improvements, 'improvement'),
  ];
  if (!valid.every(Boolean)) throw new CommandError('ast-metrics review wrote invalid or incomplete JSON.');
  return { summary, regressions: report.regressions as readonly JsonObject[], improvements: report.improvements as readonly JsonObject[], gate: report.gate };
}
