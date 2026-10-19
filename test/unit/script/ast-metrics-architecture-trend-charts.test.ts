import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import type { TrendNumbers } from '../../../script/code-quality/architecture/trend-record.ts';
import type { TrendCrapBasis } from '../../../script/code-quality/architecture/trend-basis.ts';

const { trendChartsOf } = await import(new URL('architecture/trend-charts.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/trend-charts.ts');
const basis: TrendCrapBasis = {
  kind: 'measured', coverageCommit: 'f'.repeat(40), sourceFingerprint: 'a'.repeat(64),
  inputsFingerprint: 'b'.repeat(64), buildFingerprint: 'c'.repeat(64),
  measurementVersion: 'own-characters-1', unknownFunctions: 0,
};
function record(commit: string, values: Partial<TrendNumbers> = {}): TrendNumbers {
  return { commit: commit.repeat(40), date: '2026-10-19T12:00:00Z', modularity: 0.5, crossShare: 0.2, cycles: 0, ...values };
}
function blocksOf(lines: readonly string[]): string[] {
  return [...lines.join('\n').matchAll(/```mermaid\n([\s\S]*?)\n```/gu)].map((match) => match[1] ?? '');
}

test('Given no numeric samples, when charts render, then both metrics are unavailable without a chart', () => {
  const lines = trendChartsOf([], record('a'));
  assert.ok(lines.includes('Maintainability unavailable.'));
  assert.ok(lines.includes('Functions ≥ 30 unavailable.'));
  assert.deepEqual(blocksOf(lines), []);
});

test('Given only the head has values, when charts render, then each singleton names the value and basis without a line', () => {
  const lines = trendChartsOf([record('a')], record('b', { maintainability: 56.5, functionsOver30: 0, crap: basis }));
  assert.ok(lines.includes('this pull request: 56.5 (maintainability). One point; no line.'));
  assert.ok(lines.includes('this pull request: 0 (measured). One point; no line.'));
  assert.deepEqual(blocksOf(lines), []);
});

test('Given constant zero samples, when charts render, then zero stays a value and the y range has width', () => {
  const values = { maintainability: 0, functionsOver30: 0 };
  const blocks = blocksOf(trendChartsOf([record('a', values)], record('b', values)));
  assert.equal(blocks.length, 2);
  for (const block of blocks) {
    assert.match(block, /y-axis "[^"]+" 0 --> 1/u);
    assert.match(block, /line \[0, 0\]/u);
    assert.match(block, /x-axis \["aaaaaaaa", "this pull request"\]/u);
  }
});

test('Given a nonzero constant series, when charts render, then its y range encloses the constant', () => {
  for (const [value, low, high] of [[60, 59, 61], [-5, -6, -4]]) {
    const lines = trendChartsOf([record('a', { maintainability: value })], record('b', { maintainability: value }));
    assert.ok((blocksOf(lines)[0] ?? '').includes(`y-axis "Maintainability" ${low} --> ${high}`));
  }
});

test('Given missing values between available samples, when charts render, then no line crosses the missing records', () => {
  const stored = [record('a', { maintainability: 55 }), record('b', { maintainability: 60 }), record('c'), record('d', { maintainability: 65 })];
  const lines = trendChartsOf(stored, record('e', { maintainability: 70 }));
  const blocks = blocksOf(lines);
  assert.equal(blocks.length, 2);
  assert.match((blocks[0] ?? ''), /line \[55, 60\]/u);
  assert.match((blocks[1] ?? ''), /line \[65, 70\]/u);
  assert.ok(lines.includes('Missing values are gaps; lines stop at each gap.'));
  assert.doesNotMatch(lines.join('\n'), /line \[55, 60, 65, 70\]/u);
});

test('Given each count basis changes, when charts render, then separate runs retain order and identify their basis', () => {
  const estimate = { ...basis, kind: 'head-derived-estimate' } as const;
  const stored = [record('a', { functionsOver30: 7 }), record('b', { functionsOver30: 6 }),
    record('c', { functionsOver30: 5, crap: estimate }), record('d', { functionsOver30: 4, crap: estimate }),
    record('e', { functionsOver30: 3, crap: basis })];
  const lines = trendChartsOf(stored, record('f', { functionsOver30: 2, crap: basis }));
  const blocks = blocksOf(lines);
  assert.equal(blocks.length, 3);
  assert.match((blocks[0] ?? ''), /title "Functions at CRAP 30 or more - legacy unknown"[\s\S]*line \[7, 6\]/u);
  assert.match((blocks[1] ?? ''), /title "Functions at CRAP 30 or more - head-derived estimate"[\s\S]*line \[5, 4\]/u);
  assert.match((blocks[2] ?? ''), /title "Functions at CRAP 30 or more - measured"[\s\S]*line \[3, 2\]/u);
});

test('Given singleton count runs separated by gaps and basis changes, when charts render, then each value remains explicit', () => {
  const stored = [record('a', { functionsOver30: 7 }), record('b'), record('c', { functionsOver30: 4, crap: basis })];
  const lines = trendChartsOf(stored, record('d', { functionsOver30: 3 }));
  assert.ok(lines.includes('aaaaaaaa: 7 (legacy unknown). One point; no line.'));
  assert.ok(lines.includes('cccccccc: 4 (measured). One point; no line.'));
  assert.ok(lines.includes('this pull request: 3 (legacy unknown). One point; no line.'));
  assert.deepEqual(blocksOf(lines), []);
});

test('Given hostile titles and invalid commit text, when charts render, then arbitrary labels cannot change Mermaid or Markdown', () => {
  const values = { maintainability: 55, title: '"\n```\n<script>line [999]</script>' };
  const lines = trendChartsOf([record('"\n```<x>', values)], record('b', values));
  const output = lines.join('\n');
  assert.doesNotMatch(output, /script|999|<x>/u);
  assert.match(output, /x-axis \["unknown", "this pull request"\]/u);
  assert.equal(blocksOf(lines).length, 1);
});

test('Given numeric runs, when charts render, then each block uses the documented categorical axis and numeric line grammar', () => {
  const lines = trendChartsOf([record('a', { maintainability: 55.25, functionsOver30: 3 })], record('b', { maintainability: 60, functionsOver30: 2 }));
  const number = '-?\\d+(?:\\.\\d+)?';
  for (const block of blocksOf(lines)) {
    const lines = block.split('\n');
    assert.deepEqual(lines.slice(0, 6), ['---', 'config:', '  xyChart:', '    xAxis:', '      labelRotation: 45', '---']);
    const syntax = lines.slice(6);
    assert.equal(syntax[0], 'xychart-beta');
    assert.match((syntax[1] ?? ''), /^    title "[a-zA-Z0-9 -]+"$/u);
    assert.match((syntax[2] ?? ''), /^    x-axis \["[a-f0-9]{8}", "this pull request"\]$/u);
    assert.match((syntax[3] ?? ''), new RegExp(`^    y-axis "[a-zA-Z0-9 ]+" ${number} --> ${number}$`, 'u'));
    assert.match((syntax[4] ?? ''), new RegExp(`^    line \\[${number}, ${number}\\]$`, 'u'));
    assert.equal(syntax.length, 5);
  }
});


test('Given finite values that use exponent notation or have large magnitude, when charts render, then their numbers have decimal syntax and constant axes have width', () => {
  for (const value of [1e-7, 1e20, Number.MAX_VALUE, -Number.MAX_VALUE]) {
    const blocks = blocksOf(trendChartsOf([record('a', { maintainability: value })], record('b', { maintainability: value })));
    const bounds = (blocks[0] ?? '').match(/y-axis "Maintainability" (-?[\d.]+) --> (-?[\d.]+)/u);
    assert.ok(bounds);
    assert.ok(Number(bounds[1]) < Number(bounds[2]));
    const values = (blocks[0] ?? '').match(/line \[(-?[\d.]+), (-?[\d.]+)\]/u);
    assert.ok(values);
    assert.equal(Number(values[1]), value);
    assert.equal(Number(values[2]), value);
    assert.doesNotMatch((blocks[0] ?? ''), /NaN|Infinity|\d[eE][+-]?\d/u);
  }
});
