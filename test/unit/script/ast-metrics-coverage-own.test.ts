import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { SourceScript, V8Function } from '../../../script/code-quality/coverage/input.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';

const scriptFolder = pathToFileURL(astMetricsCoverageScript);
const { mergedCoverage } = await import(new URL('coverage/merge.ts', scriptFolder).href) as typeof import('../../../script/code-quality/coverage/merge.ts');
const { writeCoverageReport } = await import(new URL('coverage/report.ts', scriptFolder).href) as typeof import('../../../script/code-quality/coverage/report.ts');
const { CommandError } = await import(new URL('shared/repository.ts', scriptFolder).href) as typeof import('../../../script/code-quality/shared/repository.ts');

function fn(name: string, whole: readonly [number, number, number], blocks: readonly (readonly [number, number, number])[] = []): V8Function {
  const [startOffset, endOffset, count] = whole;
  return { functionName: name, ranges: [{ startOffset, endOffset, count }, ...blocks.map(([startOffset, endOffset, count]) => ({ startOffset, endOffset, count }))] };
}
function script(functions: readonly V8Function[]): SourceScript {
  return { path: 'src/a.ts', representation: 'emitted-javascript', contentIdentity: 'a'.repeat(64), length: 100, functions };
}
function reportOf(t: TestContext, processes: readonly (readonly SourceScript[])[]) {
  const folder = mkdtempSync(join(tmpdir(), 'thermus-own-coverage-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  writeCoverageReport(join(folder, 'report.json'), 'a'.repeat(40), mergedCoverage(processes));
  return JSON.parse(readFileSync(join(folder, 'report.json'), 'utf8'));
}

for (const reversed of [false, true]) {
  test(`Given nested entries missing from one process and reversed=${reversed}, when calls merge, then ownership uses the union of all function ranges`, (t) => {
    const processes = [[script([fn('A', [0, 100, 1], [[40, 90, 0]])])], [script([fn('A', [0, 100, 0]), fn('B', [40, 90, 0])])]];
    const report = reportOf(t, reversed ? processes.reverse() : processes);
    assert.deepEqual(report.files[0].functions.map(({ name, coveredShare }: { name: string; coveredShare: number }) => [name, coveredShare]), [['A', 1], ['B', 0]]);
  });
}

test('Given nested grandchildren, when ownership is measured, then each descendant is subtracted once', (t) => {
  const report = reportOf(t, [[script([fn('A', [0, 100, 1], [[50, 60, 0]]), fn('B', [40, 90, 1], [[50, 60, 0]]), fn('C', [50, 60, 0])])]]);
  assert.deepEqual(report.files[0].functions.map(({ coveredShare }: { coveredShare: number }) => coveredShare), [1, 1, 0]);
});

test('Given distinct functions with equal ranges, when ownership is measured, then neither function owns the other', (t) => {
  const report = reportOf(t, [[script([fn('first', [0, 100, 1]), fn('second', [0, 100, 0])])]]);
  assert.deepEqual(report.files[0].functions.map(({ name, called, coveredShare }: { name: string; called: number; coveredShare: number }) => [name, called, coveredShare]), [['first', 1, 1], ['second', 0, 0]]);
});

test('Given an uncalled compiler helper and descendant, when shares are measured, then their ranges leave the parent mask before they leave the report', (t) => {
  const report = reportOf(t, [[script([fn('A', [0, 100, 1], [[40, 90, 0]]), fn('__helper', [40, 90, 0]), fn('nested', [50, 60, 0])])]]);
  assert.deepEqual(report.files[0].functions, [{ name: 'A', start: 0, end: 100, called: 1, coveredShare: 1 }]);
});

test('Given a helper and source function with equal ranges, when functions are filtered, then equal ranges do not prove helper descent', (t) => {
  const report = reportOf(t, [[script([fn('__helper', [0, 100, 0]), fn('source', [0, 100, 1])])]]);
  assert.deepEqual(report.files[0].functions.map(({ name }: { name: string }) => name), ['source']);
});

for (const change of [{ representation: 'source-typescript' as const }, { contentIdentity: 'b'.repeat(64) }, { length: 101 }]) {
  test(`Given conflicting script identity ${Object.keys(change)[0]}, when coverage merges, then it rejects incompatible coordinates`, () => {
    const first = script([fn('A', [0, 100, 1])]);
    assert.throws(() => mergedCoverage([[first], [{ ...first, ...change }]]), /identity|representation|incompatible/i);
  });
}

test('Given crossing function ranges across processes, when coverage merges, then it rejects invalid ownership', () => {
  assert.throws(() => mergedCoverage([[script([fn('A', [0, 70, 1])])], [script([fn('B', [40, 100, 1])])]]), /cross|overlap/i);
});

test('Given call counts whose sum is unsafe, when coverage merges, then it fails instead of rounding the count', () => {
  assert.throws(() => mergedCoverage([[script([fn('A', [0, 100, Number.MAX_SAFE_INTEGER])])], [script([fn('A', [0, 100, 1])])]]), /safe|overflow/i);
});

for (const [label, entry] of [
  ['negative offset', fn('A', [-1, 100, 1])], ['fractional offset', fn('A', [0.5, 100, 1])],
  ['non-finite offset', fn('A', [0, Infinity, 1])], ['unsafe offset', fn('A', [0, Number.MAX_SAFE_INTEGER + 1, 1])],
  ['inverted range', fn('A', [90, 40, 1])], ['empty range', fn('A', [40, 40, 1])], ['out-of-bounds range', fn('A', [0, 101, 1])],
  ['outside block', fn('A', [20, 80, 1], [[10, 30, 0]])], ['empty block', fn('A', [0, 100, 1], [[20, 20, 0]])],
  ['negative count', fn('A', [0, 100, -1])], ['fractional count', fn('A', [0, 100, 0.5])],
  ['non-finite count', fn('A', [0, 100, NaN])], ['unsafe count', fn('A', [0, 100, Number.MAX_SAFE_INTEGER + 1])],
] as const) {
  test(`Given ${label}, when coverage merges, then it rejects the raw data before it allocates or measures`, () => {
    assert.throws(() => mergedCoverage([[script([entry])]]), (error: unknown) => error instanceof CommandError && /range|count|integer|offset/i.test(error.message));
  });
}

test('Given a source function whose own text consists only of helpers, when the report is written, then its file stays present with no measured functions', (t) => {
  const report = reportOf(t, [[script([fn('wrapper', [0, 100, 1]), fn('__left', [0, 50, 0]), fn('__right', [50, 100, 0])])]]);
  assert.deepEqual(report.files[0].functions, []);
  assert.deepEqual(report.unmeasuredFunctions, [{ path: 'src/a.ts', name: 'wrapper', start: 0, end: 100, reason: 'no-own-characters' }]);
});


test('Given an uncalled whole function with a positive block, when coverage merges, then the process ran none of its characters', (t) => {
  const report = reportOf(t, [[script([fn('never', [0, 100, 0], [[20, 30, 1]])])]]);
  assert.equal(report.files[0].functions[0].called, 0);
  assert.equal(report.files[0].functions[0].coveredShare, 0);
});


test('Given a zero block overlapped by a positive block, when execution merges, then the zero block still clears its full range', (t) => {
  const report = reportOf(t, [[script([fn('run', [0, 100, 1], [[20, 80, 0], [40, 60, 1]])])]]);
  assert.equal(report.files[0].functions[0].coveredShare, 0.4);
});
