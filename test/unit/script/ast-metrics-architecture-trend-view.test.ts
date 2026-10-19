import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { TrendNumbers } from '../../../script/code-quality/architecture/trend-record.ts';
import type { TrendComponent } from '../../../script/code-quality/architecture/component-record.ts';
import type { TrendCrapBasis } from '../../../script/code-quality/architecture/trend-basis.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const folder = new URL('architecture/', pathToFileURL(astMetricsArchitectureScript));
const { trendSectionOf } = await import(new URL('trend-table.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-table.ts');
const numbers: TrendNumbers = { commit: 'a'.repeat(40), date: '2026-10-10T12:00:00Z', modularity: 0.5, crossShare: 0.2, cycles: 0 };
const component: TrendComponent = { name: 'auth', files: 1, loc: 10, paths: 2 };
const basis: TrendCrapBasis = {
  kind: 'measured', coverageCommit: 'f'.repeat(40), sourceFingerprint: 'a'.repeat(64),
  inputsFingerprint: 'b'.repeat(64), buildFingerprint: 'c'.repeat(64),
  measurementVersion: 'own-characters-1', unknownFunctions: 0,
};

for (const [title, expected] of [
  ['Title (#123)', '#123'], ['Title (#123) extra', '–'], ['Title #123', '–'],
  ['Title (#abc)', '–'], ['Title (#123) ', '–'], [undefined, '–'],
] as const) {
  test(`Given title ${JSON.stringify(title)}, when the trend renders, then only a terminal PR suffix is used`, () => {
    const rows = trendSectionOf([{ ...numbers, title }], numbers);
    assert.ok(rows.includes(`| aaaaaaaa | ${expected} | 2026-10-10 | 0.50 | 0.20 | 0 | – | – |`));
  });
}

test('Given legacy, measured and estimated component counts with missing MI, when the trend renders, then labels preserve each measure and count basis', () => {
  const stored: TrendNumbers[] = [
    { ...numbers, components: [{ ...component, functionsOver30: 2 }] },
    { ...numbers, components: [{ ...component, maintainability: 0, functionsOver30: 0, crap: basis }] },
    { ...numbers, components: [{ ...component, maintainability: 70, functionsOver30: 1, crap: { ...basis, kind: 'head-derived-estimate' } }] },
  ];
  const rows = trendSectionOf(stored, { ...numbers, components: [component] });
  assert.match(rows.join('\n'), /Historical estimates use head coverage/u);
  assert.ok(rows.includes('| auth | MI –; functions ≥ 30: 2 (legacy unknown) | MI 0.0; functions ≥ 30: 0 (measured) | MI 70.0; functions ≥ 30: 1 (estimate) | MI –; functions ≥ 30: – |'));
});

test('Given missing legacy component history and one current constant value, when the trend renders, then absence is unknown and names are sorted', () => {
  const rows = trendSectionOf([numbers], { ...numbers, components: [
    { ...component, name: 'zulu', maintainability: 70 }, { ...component, name: 'alpha', maintainability: 70 },
  ] });
  const start = rows.indexOf('### Trend by component');
  assert.deepEqual(rows.slice(start), [
    '### Trend by component', '', '| Component | aaaaaaaa | this pull request |', '| --- | --- | --- |',
    '| alpha | MI –; functions ≥ 30: – | MI 70.0; functions ≥ 30: – |',
    '| zulu | MI –; functions ≥ 30: – | MI 70.0; functions ≥ 30: – |',
  ]);
});

test('Given names and a title with Markdown and HTML text, when the trend renders, then no cell can add markup', () => {
  const name = 'a|<b>&[x]*_`\\\nnext';
  const rows = trendSectionOf([{ ...numbers, title: '<img> | **text** (#42)', components: [{ ...component, name }] }], numbers);
  assert.ok(rows.includes('| a&#124;&lt;b&gt;&amp;&#91;x&#93;&#42;&#95;&#96;&#92; next | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – |'));
  assert.ok(rows.some((row) => row.startsWith('| aaaaaaaa | #42 |')));
  assert.ok(!rows.join('\n').includes('<img>'));
});

test('Given no components in historical or current records, when the trend renders, then component history is explicitly unavailable', () => {
  assert.ok(trendSectionOf([numbers], numbers).includes('No component history in these records.'));
});

test('Given no store or an empty store and current components, when the trend renders, then it does not invent history', () => {
  const head = { ...numbers, components: [component] };
  assert.deepEqual(trendSectionOf(undefined, head), ['## Trend of src/ on main', '', 'No trend store.']);
  assert.deepEqual(trendSectionOf([], head), ['## Trend of src/ on main', '', 'No snapshot of main in the trend store yet.']);
});
