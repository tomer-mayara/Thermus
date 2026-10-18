import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

// The bands of the architecture report: the band of each community, its line in the node text, the border classes, the
// summary count, the legend, and the change of the map when a band changed. The report is pure, so the cases call it in
// the test process. Its module runs from source next to the command, as the command runs it. The types give the parts of
// the contract that the cases use, and the cases read the lines of the report.
type Functions = readonly (readonly [name: string, paths: number])[];

interface Community {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
  readonly files: number;
  readonly paths: number;
  readonly edges: readonly { readonly to: string; readonly references: number; readonly inCycle: boolean }[];
}

interface Snapshot {
  readonly commit: string;
  readonly global: { readonly modularity: number; readonly crossShare: number; readonly cycles: readonly (readonly string[])[] };
  readonly communities: readonly Community[];
  readonly files: readonly { readonly path: string; readonly maintainability: number; readonly paths: number; readonly functions: readonly { readonly name: string; readonly paths: number }[] }[];
}

interface Coverage {
  readonly files: readonly { readonly path: string; readonly functions: readonly { readonly name: string; readonly coveredShare: number }[] }[];
}

const { architectureReportOf } = await import(new URL('ast-metrics-architecture-report.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  architectureReportOf(sources: { readonly base: Snapshot; readonly head: Snapshot; readonly touched: readonly string[]; readonly coverage?: Coverage }): string;
};

// A community of one file, src/<label>.ts, with its functions. The coverage report of the cases has no file, so each
// named function is uncovered: a function of 5 decision paths has the CRAP 5² + 5 = 30, and one of 4 has 20.
function community(id: string, label: string, functions: Functions): readonly [Community, Functions] {
  return [{ id, label, members: [`src/${label}.ts`], files: 1, paths: 10, edges: [] }, functions];
}

function snapshotOf(communities: readonly (readonly [Community, Functions])[], others: Readonly<Record<string, Functions>> = {}): Snapshot {
  const fileOf = (path: string, functions: Functions) => ({ path, maintainability: 70, paths: 10, functions: functions.map(([name, paths]) => ({ name, paths })) });
  const files = [...communities.map(([{ members }, functions]) => fileOf(members[0], functions)), ...Object.entries(others).map(([path, functions]) => fileOf(path, functions))];
  return { commit: 'c0ffee00c0ffee00', global: { modularity: 0.5, crossShare: 0.25, cycles: [] }, communities: communities.map(([entry]) => entry), files };
}

// A report without files: each named function is uncovered.
const emptyCoverage: Coverage = { files: [] };

function reportOf(base: Snapshot, head: Snapshot, touched: readonly string[]): string {
  return architectureReportOf({ base, head, touched, coverage: emptyCoverage });
}

function linesOf(report: string, pattern: RegExp): string[] {
  return report.split('\n').filter((line) => pattern.test(line));
}

const nodeLines = (report: string): string[] => linesOf(report, /^ {2}c_\w+\["/);
const classLines = (report: string): string[] => linesOf(report, /^ {2}class(Def)? /);

test('Given a community without a function at 30 or more, one with such a function in both trees, and one with an added such function, when the report is made, then their bands are good, warning, and critical with their counts, and a change of the count shows with its sign', () => {
  const base = snapshotOf([community('0', 'calm', [['small', 4]]), community('1', 'known', [['big', 5]]), community('2', 'risky', [['big', 6]])]);
  const head = snapshotOf([community('0', 'calm', [['small', 4]]), community('1', 'known', [['big', 5]]), community('2', 'risky', [['big', 6], ['fresh', 5]])]);

  const report = reportOf(base, head, ['src/risky.ts']);

  assert.deepEqual(nodeLines(report), [
    '  c_calm["calm<br/>1 file · paths 10<br/>● good: 0 fn ≥ 30"]',
    '  c_known["known<br/>1 file · paths 10<br/>▲ warning: 1 fn ≥ 30"]',
    '  c_risky["risky<br/>1 file · paths 10<br/>■ critical: 2 fn ≥ 30 (+1)"]',
  ]);
});

// The minus sign is U+2212, as in the plan of the encoding.
test('Given a community that has one function at 30 or more fewer than in the base, and still one, when the report is made, then its band stays warning and its count has the change −1', () => {
  const base = snapshotOf([community('0', 'shrunk', [['first', 5], ['second', 6]])]);
  const head = snapshotOf([community('0', 'shrunk', [['first', 5], ['second', 4]])]);

  const report = reportOf(base, head, ['src/shrunk.ts']);

  assert.deepEqual(nodeLines(report), ['  c_shrunk["shrunk<br/>1 file · paths 10<br/>▲ warning: 1 fn ≥ 30 (−1)"]']);
});

test('Given a gone community with a function at 30 or more in the base and a gone one without, when the report is made, then each shows its base count with warning or good, and a new community shows its head count without a change', () => {
  const base = snapshotOf([community('0', 'calm', [['small', 4]]), community('1', 'old', [['big', 7]])]);
  const head = snapshotOf([community('2', 'young', [['big', 7], ['fresh', 6]])]);

  const report = reportOf(base, head, []);

  assert.deepEqual(nodeLines(report), [
    '  c_calm["calm · gone<br/>1 file · paths 10<br/>● good: 0 fn ≥ 30"]',
    '  c_old["old · gone<br/>1 file · paths 10<br/>▲ warning: 1 fn ≥ 30"]',
    '  c_young["young · new<br/>1 file · paths 10<br/>■ critical: 2 fn ≥ 30"]',
  ]);
});

// The band classes set the border color only: the width stays the channel of a touched community, as the legend says.
test('Given nodes of each band, a touched one among them, and a gone one, when the report is made, then the block defines only the band classes that it uses, in the order good, warning, critical, after touched and gone, and the class lines follow in the same order, so that a touched node is in its touched line and in its band line', () => {
  const base = snapshotOf([community('0', 'calm', [['small', 4]]), community('1', 'known', [['big', 5]]), community('3', 'old', [['tiny', 1]])]);
  const head = snapshotOf([community('0', 'calm', [['small', 4]]), community('1', 'known', [['big', 5]]), community('2', 'risky', [['fresh', 5]])]);

  const report = reportOf(base, head, ['src/known.ts']);

  assert.deepEqual(classLines(report), [
    '  classDef touched stroke-width:3px',
    '  classDef gone stroke-dasharray:4 4,color:#999999',
    '  classDef good stroke:#0ca30c',
    '  classDef warning stroke:#fab219',
    '  classDef critical stroke:#d03b3b',
    '  class c_known touched',
    '  class c_old gone',
    '  class c_calm,c_old good',
    '  class c_known warning',
    '  class c_risky critical',
  ]);
});

test('Given nodes that are all good, when the report is made, then the block defines the good class only', () => {
  const tree = snapshotOf([community('0', 'calm', [['small', 4]]), community('1', 'quiet', [])]);

  const report = reportOf(tree, tree, ['src/calm.ts']);

  assert.deepEqual(classLines(report), ['  classDef touched stroke-width:3px', '  classDef gone stroke-dasharray:4 4,color:#999999', '  classDef good stroke:#0ca30c', '  class c_calm touched', '  class c_calm,c_quiet good']);
});

const bandLegend = 'border color = the CRAP band of the community (● good: no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse); numbers =';

test('Given a coverage report, when the report is made, then the summary line ends with the count of the functions at 30 or more in all of src/, files in no community included, the legend names the bands before the numbers, and no line says that the bands need the coverage', () => {
  const base = snapshotOf([community('0', 'known', [['big', 5]])], { 'src/loose.ts': [['wide', 9]] });
  const head = snapshotOf([community('0', 'known', [['big', 5], ['more', 6]])], { 'src/loose.ts': [['wide', 9], ['wider', 8]] });

  const report = reportOf(base, head, ['src/known.ts']);

  assert.equal(report.split('\n')[2], 'Modularity 0.50 → 0.50 · cross share 0.25 → 0.25 · cycles 0 → 0 · communities 1 → 1 · functions ≥ 30: 2 → 4');
  assert.equal(report.split('\n')[4], '```mermaid');
  assert.ok(report.includes(bandLegend), report);
  assert.equal(report.includes('Bands need the coverage'), false, report);
});

test('Given no coverage report, when the report is made, then the summary line has no count, the next line says that the bands need the coverage run, and the graph has no band text, no band class, and no band legend', () => {
  const tree = snapshotOf([community('0', 'known', [['big', 5]])]);

  const report = architectureReportOf({ base: tree, head: tree, touched: ['src/known.ts'] });

  assert.deepEqual(report.split('\n').slice(2, 6), [
    'Modularity 0.50 → 0.50 · cross share 0.25 → 0.25 · cycles 0 → 0 · communities 1 → 1',
    '',
    'Bands need the coverage: run pnpm exec node script/ast-metrics-coverage.ts first.',
    '',
  ]);
  assert.deepEqual(nodeLines(report), ['  c_known["known<br/>1 file · paths 10"]']);
  assert.deepEqual(classLines(report), ['  classDef touched stroke-width:3px', '  classDef gone stroke-dasharray:4 4,color:#999999', '  class c_known touched']);
  assert.equal(report.includes('border color ='), false, report);
});

// No community is touched, new, or gone, and the dependencies stay. Only a band can change the map then.
for (const [name, before, after, changed] of [
  ['a band that went from warning to good', [['big', 5]], [['big', 4]], true],
  ['a band that went from good to critical', [['small', 4]], [['small', 5]], true],
  ['a band that stays warning with a lower count', [['big', 5], ['bigger', 6]], [['big', 5], ['bigger', 4]], false],
  ['a band that stays good', [['small', 4]], [['small', 3]], false],
] as const) {
  test(`Given ${name} and no other change of the map, when the report is made, then the map ${changed ? 'changed' : 'did not change'}`, () => {
    const report = reportOf(snapshotOf([community('0', 'only', before)]), snapshotOf([community('0', 'only', after)]), []);

    assert.equal(report.includes('```mermaid\n'), changed, report);
    assert.equal(report.includes('\n\nThe map did not change.\n\n'), !changed, report);
  });
}
