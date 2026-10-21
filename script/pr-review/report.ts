import type { Change, CheckResult, Declaration } from './types.ts';

export function markdownOf(result: CheckResult): string {
  const { lineCounts: counts, tests } = result;
  return [
    '## Review route', '',
    `Route: \`${result.route}\``,
    `Candidate: ${result.candidate}`,
    `Merge base: ${result.mergeBase}`, '',
    ...section('Reasons', result.reasons.map((reason) => `${reason.route} ${reason.key}: ${reason.fact}`)),
    ...section('Questions to answer', result.questions.map((entry) => `${entry.key}: ${entry.question}`)),
    ...section('Changed paths', result.changedPaths.map(changeLine)),
    ...section('Line counts', [`Production: ${counts.production} (limit ${counts.productionLimit})`, `Total without generated files: ${counts.total} (limit ${counts.totalLimit})`]),
    ...section('Tests', [`Added test cases: ${tests.added}`, `Removed test cases: ${tests.removed}`, `Added skips or todos: ${tests.skippedOrTodo.join(', ') || 'none'}`]),
    ...section('MI', result.mi),
    ...section('CRAP', result.crap),
    ...section('Facts to declare', result.factsToDeclare.map(declarationLine)),
    ...section('Declared facts', result.declaredFacts.map(declarationLine)),
    ...section('Surface differences', result.surfaceDifferences),
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

function changeLine(change: Change): string {
  return change.oldPath === undefined ? `${change.status} ${change.path}` : `${change.status} ${change.oldPath} -> ${change.path}`;
}

function declarationLine(declaration: Declaration): string {
  return `${declaration.key}: ${declaration.value}`;
}
