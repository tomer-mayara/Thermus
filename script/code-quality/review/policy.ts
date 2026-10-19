import { CommandError } from '../shared/repository.ts';
import { objectOf, type JsonObject } from '../shared/json.ts';
import { reviewReportOf } from './schema.ts';
import { textOrder } from '../shared/order.ts';

export function adjustedReview(text: string, base: string, layers: readonly JsonObject[]): JsonObject | undefined {
  const report = reviewReportOf(text, base);
  const retained = report.regressions.filter((finding) => {
    if (finding.rule !== 'new-complex-function') return true;
    if (!Number.isSafeInteger(finding.after) || Number(finding.after) < 0) throw new CommandError('ast-metrics review wrote a new-function finding without valid path evidence.');
    return finding.after !== 10 || finding.severity !== 'medium';
  });
  if (retained.length === report.regressions.length && layers.length === 0) return undefined;
  const regressions = [...retained, ...layers];
  const severityRank = ['high', 'medium', 'low'];
  regressions.sort((a, b) => severityRank.indexOf(String(a.severity)) - severityRank.indexOf(String(b.severity)) || textOrder(String(a.file), String(b.file)) || textOrder(String(a.subject ?? ''), String(b.subject ?? '')));
  const summary = { ...report.summary, ...Object.fromEntries(severityRank.map((severity) => [severity, regressions.filter((finding) => finding.severity === severity).length])) };
  const nativeReview = objectOf(JSON.parse(text));
  return { ...nativeReview, nativeReview, reviewPolicy: { version: 1, source: 'Thermus review wrapper', newFunctionPaths: '>10', highFunctionPaths: '>=25', layerSource: 'CR-13 resolved imports' }, summary, regressions, gate: summary.high === 0 ? 'passed' : 'failed' };
}

function inline(value: unknown): string {
  return String(value).replaceAll('\\', '\\\\').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/[\r\n]/gu, ' ').replace(/[`*_\[\]|]/gu, '\\$&');
}

function code(value: unknown): string {
  const text = String(value).replace(/[\r\n]/gu, ' ');
  let marker = '`';
  while (text.includes(marker)) marker += '`';
  const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${marker}${padding}${text}${padding}${marker}`;
}

function findingLines(finding: JsonObject): string[] {
  const location = `${String(finding.file)}${finding.line ? `:${String(finding.line)}` : ''}`;
  return [
    `- **${inline(finding.severity)}**: ${inline(finding.message)} (${code(location)}, rule ${code(finding.rule)}${finding.subject ? `, ${code(finding.subject)}` : ''})`,
    ...(finding.suggestion ? [`  ${inline(finding.suggestion)}`] : []),
  ];
}

export function reviewMarkdown(report: JsonObject, maxFindings: number): string {
  const summary = objectOf(report.summary);
  const regressions = report.regressions as readonly JsonObject[];
  const improvements = report.improvements as readonly JsonObject[];
  const shown = regressions.slice(0, maxFindings);
  return [
    '## AST Metrics review', '', 'Thermus review policy: new-function warnings require >10 paths; high starts at 25. Approved layer rules use CR-13 resolved imports.', '',
    `Regressions: ${summary.high} high, ${summary.medium} medium, ${summary.low} low. Improvements: ${summary.improvements}. Gate: ${report.gate}.`, '',
    ...(shown.length ? ['### Regressions', '', ...shown.flatMap(findingLines), ''] : ['No new or worsened finding.', '']),
    ...(shown.length < regressions.length ? [`${regressions.length - shown.length} more regression(s); the JSON report retains all findings.`, ''] : []),
    ...(improvements.length ? ['### Improvements', '', ...improvements.slice(0, maxFindings).flatMap(findingLines), '', ...(improvements.length > maxFindings ? [`${improvements.length - maxFindings} more improvement(s); the JSON report retains all findings.`, ''] : [])] : []),
  ].join('\n');
}
