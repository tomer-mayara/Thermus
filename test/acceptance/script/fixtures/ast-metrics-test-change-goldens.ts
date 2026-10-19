const unchangedComplexity = '## Complexity of the changed files\n\nNo production file changed.';

export const coveredTestChanges = `${unchangedComplexity}\n\nTest changes are not judged: the base uses the coverage of the head.`;
export const unavailableTestChanges = `${unchangedComplexity}\n\nTest changes are not judged: no coverage comparison was made.`;
export const sourceAndTestChanges = unchangedComplexity;
export const sourceAndTypeScriptTestChanges = [
  '## Complexity of the changed files', '',
  '| File | Maintainability | Decision paths | CRAP ≥ 30 | Risk rank |',
  '| --- | --- | --- | --- | --- |',
  '| src/core/old.ts | 90.0 → 90.0 | 6 → 6 | 1 → 1 | 1 |', '',
  '### Functions at CRAP 30 or more, added or worse', '', 'None.', '',
  'Unmatched functions: 0 (anonymous, duplicate, or not in the coverage).',
].join('\n');

export function testChangeSection(report: string): string {
  return report.slice(report.indexOf('## Complexity of the changed files'))
    .split(/\n\n(?:Unknown function identity:|Base functions without|Coverage:|## Trend)/u)[0].trimEnd();
}
