import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

// The rules of the architecture report: the matching, the node ids and texts, the arrows, and the change of the map.
// The report is pure, so the cases call it in the test process. Its module runs from source next to the command, as the
// command runs it. The types give the parts of the contract that the cases use, and the cases read the lines of the
// graph. ast-metrics-architecture-table.test.ts specifies the complexity table at the end of the report.
interface Community {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
  readonly files: number;
  readonly maintainability?: number;
  readonly paths: number;
  readonly edges: readonly { readonly to: string; readonly references: number; readonly inCycle: boolean }[];
}

interface Snapshot {
  readonly commit: string;
  readonly global: { readonly modularity: number; readonly crossShare: number; readonly cycles: readonly (readonly string[])[] };
  readonly communities: readonly Community[];
  readonly files: readonly { readonly path: string; readonly maintainability?: number; readonly paths: number }[];
}

const { architectureReportOf } = await import(new URL('architecture/report.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  architectureReportOf(sources: { readonly base: Snapshot; readonly head: Snapshot; readonly touched: readonly string[] }, delta: undefined): string;
};

// One file for each member, in the folder of the label, unless the parts name the members.
function community(id: string, label: string, parts: Partial<Community> & { readonly count?: number } = {}): Community {
  const members = parts.members ?? Array.from({ length: parts.count ?? 1 }, (_, index) => `src/${label}/${index}.ts`);
  return { id, label, members, files: members.length, paths: 10, edges: [], ...parts };
}

// Each member of a community is a file of the snapshot.
function snapshotOf(communities: readonly Community[], cycles: readonly (readonly string[])[] = []): Snapshot {
  const files = communities.flatMap(({ members }) => members.map((path) => ({ path, maintainability: 70, paths: 5 })));
  return { commit: 'c0ffee00c0ffee00', global: { modularity: 0.5, crossShare: 0.25, cycles }, communities, files };
}

const noProductionFileEnd = '\n\n## Complexity of the changed files\n\nNo production file changed.\n';

function reportOf(base: Snapshot, head: Snapshot, touched: readonly string[] = []): string {
  return architectureReportOf({ base, head, touched }, undefined);
}

function graphLines(report: string, pattern: RegExp): string[] {
  return report.split('\n').filter((line) => pattern.test(line));
}

const nodeLines = (report: string): string[] => graphLines(report, /^ {2}c_\w+\["/);
const edgeLines = (report: string): string[] => graphLines(report, /^ {2}c_\w+ (--|-\.|==) /);

test('Given a head community with 2 of the 4 files of a base community, and one with 1 of 3 files of another, when the report is made, then the overlap of 0.5 matches and the overlap of 1/3 gives one new and one gone community', () => {
  const base = snapshotOf([community('0', 'kept', { count: 4 }), community('1', 'old', { count: 3 })]);
  const head = snapshotOf([community('5', 'kept', { members: ['src/kept/0.ts', 'src/kept/1.ts'] }), community('6', 'young', { members: ['src/old/0.ts'] })]);

  const report = reportOf(base, head);

  assert.deepEqual(nodeLines(report), [
    '  c_kept["kept<br/>2 files ↓2 · paths 10"]',
    '  c_old["old · gone<br/>3 files · paths 10"]',
    '  c_young["young · new<br/>1 file · paths 10"]',
  ]);
  assert.equal(report.split('\n')[2], 'Modularity 0.50 → 0.50 · cross share 0.25 → 0.25 · cycles 0 → 0 · communities 2 → 2 (1 new, 1 gone)');
});

test('Given two head communities with an equal overlap of 0.5 with one base community, when the report is made, then the first head label matches, not the first in the snapshot, and the other is new', () => {
  const base = snapshotOf([community('0', 'whole', { members: ['src/a.ts', 'src/b.ts'] })]);
  const head = snapshotOf([community('1', 'zulu', { members: ['src/a.ts'] }), community('2', 'alpha', { members: ['src/b.ts'] })]);

  const report = reportOf(base, head);

  assert.deepEqual(nodeLines(report), ['  c_alpha["alpha<br/>1 file ↓1 · paths 10"]', '  c_zulu["zulu · new<br/>1 file · paths 10"]']);
});

test('Given two head communities that overlap one base community by 0.5 and by 0.75, when the report is made, then the larger overlap matches first, and the base community matches only once', () => {
  const base = snapshotOf([community('0', 'whole', { count: 4 })]);
  const head = snapshotOf([community('1', 'first', { members: ['src/whole/0.ts', 'src/whole/1.ts'] }), community('2', 'second', { members: ['src/whole/0.ts', 'src/whole/1.ts', 'src/whole/2.ts'] })]);

  const report = reportOf(base, head);

  assert.deepEqual(nodeLines(report), ['  c_first["first · new<br/>2 files · paths 10"]', '  c_second["second<br/>3 files ↓1 · paths 10"]']);
});

// ast-metrics renumbers and renames its communities when code grows elsewhere.
test('Given a head whose communities have other ids and labels but the same files and dependencies, when the report is made, then the communities and their dependencies match, and the map did not change', () => {
  const base = snapshotOf([community('0', 'auth', { edges: [{ to: '1', references: 2, inCycle: false }] }), community('1', 'kernel')]);
  const head = snapshotOf([
    community('7', 'auth (session)', { members: ['src/auth/0.ts'], edges: [{ to: 'shared', references: 2, inCycle: false }] }),
    community('shared', 'shared kernel', { members: ['src/kernel/0.ts'] }),
  ]);

  const report = reportOf(base, head);

  assert.ok(report.includes('\n\nThe map did not change.\n\n```mermaid\n'), report);
  assert.ok(report.endsWith(noProductionFileEnd), report);
  assert.equal(nodeLines(report).length, head.communities.length);
});

test('Given labels with a Mermaid keyword, a double quote, a backtick, upper case, and parentheses, when the report is made, then each id is c_ and the label in lower case with _ for each other character, and each label text has a single quote for each quote and backtick', () => {
  const labels = ['end', 'quote " and tick `', 'Mixed Case', 'auth (session)'];
  const head = snapshotOf(labels.map((label, index) => community(String(index), label, { members: [`src/${index}.ts`] })));

  const report = reportOf(snapshotOf([]), head);

  assert.deepEqual(nodeLines(report), [
    '  c_mixed_case["Mixed Case · new<br/>1 file · paths 10"]',
    '  c_auth__session_["auth (session) · new<br/>1 file · paths 10"]',
    '  c_end["end · new<br/>1 file · paths 10"]',
    '  c_quote___and_tick__["quote \' and tick \' · new<br/>1 file · paths 10"]',
  ]);
});

test('Given a gone community and a new one with the same label, when the report is made, then the new one keeps the id of the label, the gone one gets a number, and each edge names the right node', () => {
  const kernel = community('k', 'kernel');
  const base = snapshotOf([kernel, community('0', 'mcp', { count: 3, edges: [{ to: 'k', references: 4, inCycle: false }] })]);
  const head = snapshotOf([kernel, community('5', 'mcp', { members: ['src/mcp/new.ts'], edges: [{ to: 'k', references: 1, inCycle: false }] })]);

  const report = reportOf(base, head);

  assert.deepEqual(nodeLines(report), ['  c_kernel["kernel<br/>1 file · paths 10"]', '  c_mcp["mcp · new<br/>1 file · paths 10"]', '  c_mcp_2["mcp · gone<br/>3 files · paths 10"]']);
  assert.deepEqual(edgeLines(report), ['  c_mcp == "1 · new" ==> c_kernel', '  c_mcp_2 -. "gone" .-> c_kernel']);
  assert.deepEqual(graphLines(report, /linkStyle|class /), ['  linkStyle 1 stroke:#999999,stroke-dasharray:4 4', '  class c_mcp_2 gone']);
});

test('Given changes of files, maintainability, decision paths, and references, when the report is made for a touched community, then each change shows as an arrow and its size after the value, maintainability with one decimal, and a change that rounds to zero or that has no base value shows nothing', () => {
  const base = snapshotOf([
    community('0', 'a', { count: 3, maintainability: 60.04, paths: 10, edges: [{ to: '1', references: 5, inCycle: false }] }),
    community('1', 'b', { maintainability: 55.5, paths: 7 }),
    community('2', 'c', { maintainability: 70, paths: 3 }),
    community('3', 'd', { paths: 3 }),
  ]);
  const head = snapshotOf([
    community('0', 'a', { count: 4, maintainability: 60, paths: 7, edges: [{ to: '1', references: 3, inCycle: false }] }),
    community('1', 'b', { maintainability: 55.1, paths: 7 }),
    community('2', 'c', { maintainability: 72.25, paths: 3 }),
    community('3', 'd', { maintainability: 64, paths: 3 }),
  ]);

  const report = reportOf(base, head, ['src/a/0.ts']);

  assert.deepEqual(nodeLines(report), [
    '  c_a["a<br/>4 files ↑1 · MI 60.0 · paths 7 ↓3"]',
    '  c_b["b<br/>1 file · MI 55.1 ↓0.4 · paths 7"]',
    '  c_c["c<br/>1 file · MI 72.3 ↑2.3 · paths 3"]',
    '  c_d["d<br/>1 file · MI 64.0 · paths 3"]',
  ]);
  assert.deepEqual(edgeLines(report), ['  c_a -- "3 ↓2" --> c_b']);
  assert.deepEqual(graphLines(report, /class /), ['  class c_a touched']);
});

const pair = (edges: Community['edges'] = []) => [community('0', 'a', { edges }), community('1', 'b')];
const toB = { to: '1', references: 2, inCycle: false };

for (const [name, base, head, touched, changed] of [
  ['equal snapshots', snapshotOf(pair([toB])), snapshotOf(pair([toB])), [], false],
  ['only other numbers and references', snapshotOf(pair([toB])), snapshotOf([community('0', 'a', { paths: 99, maintainability: 50, edges: [{ ...toB, references: 9 }] }), community('1', 'b')]), [], false],
  ['a touched file that no community holds', snapshotOf(pair()), snapshotOf(pair()), ['src/other.ts', 'test/a.test.ts'], false],
  ['a touched file of a community', snapshotOf(pair()), snapshotOf(pair()), ['src/b/0.ts'], true],
  ['a new dependency', snapshotOf(pair()), snapshotOf(pair([toB])), [], true],
  ['a gone dependency', snapshotOf(pair([toB])), snapshotOf(pair()), [], true],
  ['a new cycle of the same dependencies', snapshotOf(pair([toB])), snapshotOf(pair([toB]), [['a', 'b']]), [], true],
  ['the same cycle under other labels', snapshotOf(pair([toB]), [['a', 'b']]), snapshotOf([community('0', 'x', { members: ['src/a/0.ts'], edges: [toB] }), community('1', 'y', { members: ['src/b/0.ts'] })], [['x', 'y']]), [], false],
] as const) {
  test(`Given ${name}, when the report is made, then the map ${changed ? 'changed' : 'did not change'}`, () => {
    const report = reportOf(base, head, touched);

    assert.ok(report.includes('```mermaid\n'), report);
    assert.equal(report.includes('\n\nThe map did not change.\n\n'), !changed, report);
  });
}

test('Given a gone dependency between two matched communities, when the report is made, then its edge is dashed with gone and a grey link style', () => {
  const report = reportOf(snapshotOf(pair([toB])), snapshotOf(pair()));

  assert.deepEqual(edgeLines(report), ['  c_a -. "gone" .-> c_b']);
  assert.deepEqual(graphLines(report, /linkStyle/), ['  linkStyle 0 stroke:#999999,stroke-dasharray:4 4']);
});
