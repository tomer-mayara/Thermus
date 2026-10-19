import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsReviewScript } from '../../support/processes/module-paths.ts';

const { adjustedReview, reviewMarkdown } = await import(new URL('review/policy.ts', pathToFileURL(astMetricsReviewScript)).href) as typeof import('../../../script/code-quality/review/policy.ts');

function nativeReport(regressions: readonly Record<string, unknown>[]) {
  return { methodologyVersion: '1.1', baseRef: 'main', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40), extraMetadata: 'retained', summary: { filesChanged: 3, filesAdded: 1, filesDeleted: 0, high: regressions.filter((finding) => finding.severity === 'high').length, medium: regressions.filter((finding) => finding.severity === 'medium').length, low: regressions.filter((finding) => finding.severity === 'low').length, improvements: 1 }, regressions, improvements: [{ kind: 'improvement', severity: 'low', rule: 'complexity-improvement', file: 'src/b.ts', message: 'Fewer paths', before: 5, after: 1 }], gate: regressions.some((finding) => finding.severity === 'high') ? 'failed' : 'passed' };
}

function finding(rule: string, after: unknown, severity = 'medium') {
  return { kind: 'regression', severity, rule, file: `src/${rule}-${String(after)}.ts`, subject: 'function', message: 'Native message', suggestion: 'Native suggestion', before: 0, after };
}

test('The strict new-function boundary removes only ten-path medium findings and retains native metadata, improvements, other findings, and full native evidence', () => {
  const removed = finding('new-complex-function', 10);
  const eleven = finding('new-complex-function', 11);
  const high = finding('new-complex-function', 25, 'high');
  const modified = finding('complexity-regression', 10);
  const original = nativeReport([removed, eleven, high, modified]);
  const adjusted = adjustedReview(JSON.stringify(original), 'main', []);
  assert.ok(adjusted);
  assert.equal(adjusted.extraMetadata, original.extraMetadata);
  assert.deepEqual(adjusted.nativeReview, original);
  assert.deepEqual(adjusted.improvements, original.improvements);
  assert.deepEqual(new Set((adjusted.regressions as unknown[]).map((entry) => JSON.stringify(entry))), new Set([eleven, high, modified].map((entry) => JSON.stringify(entry))));
  assert.deepEqual(adjusted.summary, { ...original.summary, medium: 2 });
  assert.equal(adjusted.gate, 'failed');
  const markdown = reviewMarkdown(adjusted, 1);
  assert.match(markdown, /1 high, 2 medium, 0 low/);
  assert.match(markdown, /Native suggestion/);
  assert.match(markdown, /2 more regression\(s\)/);
  assert.match(markdown, /Fewer paths/);
});

test('A report without boundary or layer changes keeps its native Markdown and JSON', () => {
  assert.equal(adjustedReview(JSON.stringify(nativeReport([finding('complexity-regression', 10)])), 'main', []), undefined);
});

for (const after of [undefined, '10', -1, 10.5]) test(`A new-function finding with invalid numeric path evidence ${String(after)} fails instead of using its message`, () => {
  assert.throws(() => adjustedReview(JSON.stringify(nativeReport([finding('new-complex-function', after)])), 'main', []), /valid path evidence/);
});

test('Ten-path suppression cannot remove a native high finding', () => {
  assert.equal(adjustedReview(JSON.stringify(nativeReport([finding('new-complex-function', 10, 'high')])), 'main', []), undefined);
});

test('An unexpected native new-function finding below ten paths is preserved', () => {
  assert.equal(adjustedReview(JSON.stringify(nativeReport([finding('new-complex-function', 9)])), 'main', []), undefined);
});

test('Regenerated Markdown keeps special characters in findings readable without introducing HTML or table markup', () => {
  const original = nativeReport([finding('new-complex-function', 10), { ...finding('other-rule', 2), message: '<script> & [label] | *message*\nnext', file: 'src/[name]|file.ts' }]);
  const adjusted = adjustedReview(JSON.stringify(original), 'main', []);
  assert.ok(adjusted);
  const markdown = reviewMarkdown(adjusted, 50);
  assert.match(markdown, /&lt;script&gt; &amp;/);
  assert.ok(markdown.includes('\\[label\\] \\| \\*message\\* next'));
  assert.ok(markdown.includes('`src/[name]|file.ts`'));
  assert.doesNotMatch(markdown, /<script>/);
});

test('Backticks in source locations cannot close the regenerated Markdown code span', () => {
  const original = nativeReport([finding('new-complex-function', 10), { ...finding('other-rule', 2), file: 'src/a`b.ts' }]);
  const adjusted = adjustedReview(JSON.stringify(original), 'main', []);
  assert.ok(adjusted);
  assert.ok(reviewMarkdown(adjusted, 50).includes('``src/a`b.ts``'));
});
