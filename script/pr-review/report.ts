import { reasonName } from './tier.ts';
import type { ArchitectureFact, Change, CheckResult, Declaration } from './types.ts';

// The report shows the first lines of each diff; the JSON output keeps the full diff.
const shownDiffLines = 60;

export function markdownOf(result: CheckResult): string {
  const { lineCounts: counts, tests, architecture } = result;
  return [
    '## Review tier', '',
    `Tier: \`${result.tierName}\``,
    `Local eligibility: \`${result.eligibility}\``,
    `Architecture: ${architecture.summary}`,
    `Candidate: ${result.candidate}`,
    `Merge base: ${result.mergeBase}`, '',
    ...section('Architecture facts', architecture.facts.map((fact) => `${fact.key}: ${fact.fact}`)),
    ...architecture.facts.flatMap(detailLines),
    ...section('Reasons', result.reasons.filter((reason) => !reason.key.startsWith('evidence.')).map((reason) => `${reasonName(reason)} ${reason.key}: ${reason.fact}`)),
    ...section('Evidence blockers', result.blockers.filter((reason) => reason.key.startsWith('evidence.')).map((reason) => `${reason.key}: ${reason.fact}`)),
    ...section('Questions to answer', result.questions.map((entry) => `${entry.key}: ${entry.question}`)),
    ...section('Changed paths', result.changedPaths.map(changeLine)),
    ...section('Line counts', [`Production: ${counts.production} (limit ${counts.productionLimit})`, `Total without generated files: ${counts.total} (limit ${counts.totalLimit})`]),
    ...section('Tests', [`Added test cases: ${tests.added}`, `Removed test cases: ${tests.removed}`, `Added skips or todos: ${tests.skippedOrTodo.join(', ') || 'none'}`]),
    ...section('MI', result.mi),
    ...section('CRAP', result.crap),
    ...section('Metrics', result.metrics),
    ...section('Facts to declare', result.factsToDeclare.map(declarationLine)),
    ...section('Declared facts', result.declaredFacts.map(declarationLine)),
    ...section('Surface differences', result.surfaceDifferences),
    ...section('Informational', result.informational),
    ...section('Notes', result.notes),
    'Label:', `\`${result.label}\``, '',
  ].join('\n');
}

export function jsonOf(result: CheckResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

function section(heading: string, items: readonly string[]): string[] {
  return [`${heading}:`, ...(items.length > 0 ? items : ['none']).map((item) => `- ${item}`), ''];
}

function detailLines(fact: ArchitectureFact): string[] {
  if (fact.detail === undefined || fact.detail === '') return [];
  const lines = fact.detail.replace(/\n$/u, '').split('\n');
  const shown = lines.slice(0, shownDiffLines);
  const cut = lines.length - shown.length;
  const fence = fenceOf(shown);
  const cutLine = cut > 0 ? [`The report cuts ${cut} ${cut === 1 ? 'line' : 'lines'} of this diff. The JSON output has the full diff.`] : [];
  return [`${fact.fact}:`, '', `${fence}diff`, ...shown, fence, ...cutLine, ''];
}

// The fence is longer than each run of backticks in the diff, so that no line of the diff can close it.
function fenceOf(lines: readonly string[]): string {
  const runs = lines.flatMap((line) => line.match(/`+/gu) ?? []).map((run) => run.length + 1);
  return '`'.repeat(Math.max(3, ...runs));
}

function changeLine(change: Change): string {
  return change.oldPath === undefined ? `${change.status} ${change.path}` : `${change.status} ${change.oldPath} -> ${change.path}`;
}

function declarationLine(declaration: Declaration): string {
  return `${declaration.key}: ${declaration.value}`;
}
