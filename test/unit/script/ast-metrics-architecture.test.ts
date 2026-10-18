import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// An empty PATH has no git and no ast-metrics. Thus these cases also show that the command checks its arguments first,
// and that it reads snapshot files without either tool.
const noTools = { env: { PATH: '' } };

test('Given --help, when the architecture command runs, then it explains the two sources of the snapshots, the changed files, the matching, the change of the map, the options, and the exit status', async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--help'], ...noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Usage: node script\/ast-metrics-architecture\.ts \[--base REF\] \[--head FILE --base-snapshot FILE\] \[--touched FILES\] \[--timeout-ms MS\] \[--out FILE\] \[--help\]\n/);
  const texts = ['Mermaid', 'merge base', 'temporary worktree', 'working tree', 'untracked', 'Jaccard', '0.5', 'new or gone', 'did not change', 'default: origin/main'];
  for (const text of [...texts, 'default: 60000', 'not a gate', 'Exit status 1', 'Exit status 130 or 143']) {
    assert.ok(result.stdout.includes(text), `The help does not name ${text}.`);
  }
});

const together = 'Give --head and --base-snapshot together, each with a snapshot file.';

for (const [args, diagnostic] of [
  [['--head', 'snapshot.json'], together],
  [['--base-snapshot', 'snapshot-base.json'], together],
  [['--head=', '--base-snapshot', 'snapshot-base.json'], together],
  [['--base='], 'The --base value must name a git ref.'],
  [['--base=--output=diff.txt'], 'The --base value must name a git ref.'],
  [['--out='], 'The --out value must name a file.'],
  [['--timeout-ms', '99'], 'The --timeout-ms value must be an integer from 100 to 300000.'],
  [['--timeout-ms', '1e3'], 'The --timeout-ms value must be an integer from 100 to 300000.'],
  [['--verbose'], 'Invalid arguments. Use --help for the supported options.'],
  [['main'], 'Invalid arguments. Use --help for the supported options.'],
  [['--head'], 'Invalid arguments. Use --help for the supported options.'],
] as const) {
  test(`Given the arguments ${args.join(' ')}, when the architecture command runs, then it fails with one diagnostic line`, async (t) => {
    const result = await runScript(t, astMetricsArchitectureScript, { args, ...noTools });

    assert.equal(result.stderr, `ast-metrics-architecture: ${diagnostic}\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

// The parts of a snapshot that the command reads, as script/ast-metrics-snapshot.ts writes them.
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
  readonly version: 1;
  readonly commit: string;
  readonly global: { readonly modularity: number; readonly crossShare: number; readonly cycles: readonly (readonly string[])[] };
  readonly communities: readonly Community[];
}

// One file for each member, in the folder of the label.
function community(id: string, label: string, parts: Partial<Community> & { readonly count?: number } = {}): Community {
  const members = parts.members ?? Array.from({ length: parts.count ?? 1 }, (_, index) => `src/${label}/${index}.ts`);
  return { id, label, members, files: members.length, paths: 10, edges: [], ...parts };
}

function snapshotOf(communities: readonly Community[], cycles: readonly (readonly string[])[] = []): Snapshot {
  return { version: 1, commit: 'c0ffee00c0ffee00', global: { modularity: 0.5, crossShare: 0.25, cycles }, communities };
}

// Writes each text to a file of its own and gives the arguments that name the files.
function fileArguments(t: TestContext, head: string, base: string): string[] {
  const folder = dataDirectory(t);
  writeFileSync(join(folder, 'head.json'), head);
  writeFileSync(join(folder, 'base.json'), base);
  return ['--head', join(folder, 'head.json'), '--base-snapshot', join(folder, 'base.json')];
}

test('Given a --head file that does not exist, when the architecture command runs, then it fails with one diagnostic line that names the file', async (t) => {
  const missing = join(dataDirectory(t), 'missing.json');

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--head', missing, '--base-snapshot', missing], ...noTools });

  assert.equal(result.stderr, `ast-metrics-architecture: Cannot read the snapshot file ${missing}.\n`);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

const valid = snapshotOf([community('0', 'a')]);

for (const [name, text] of [
  ['text that is not JSON', 'Snapshot'],
  ['a JSON array', '[]'],
  ['a snapshot of version 2', JSON.stringify({ ...valid, version: 2 })],
  ['a snapshot without a commit', JSON.stringify({ ...valid, commit: undefined })],
  ['a modularity that is text', JSON.stringify({ ...valid, global: { ...valid.global, modularity: '0.5' } })],
  ['a snapshot without communities', JSON.stringify({ ...valid, communities: undefined })],
  ['a community without a label', JSON.stringify({ ...valid, communities: [{ ...community('0', 'a'), label: undefined }] })],
  ['an edge without a target', JSON.stringify({ ...valid, communities: [{ ...community('0', 'a'), edges: [{ references: 1, inCycle: false }] }] })],
] as const) {
  test(`Given a --base-snapshot file with ${name}, when the architecture command runs, then it fails with one diagnostic line that names the file`, async (t) => {
    const args = fileArguments(t, JSON.stringify(valid), text);

    const result = await runScript(t, astMetricsArchitectureScript, { args, ...noTools });

    assert.equal(result.stderr, `ast-metrics-architecture: The file ${args[3]} is not a valid snapshot of version 1.\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

// The report is pure, so the cases below call it in the test process. Its module runs from source next to the command,
// as the command runs it. The cases read the node and the edge lines of the graph.
const { architectureReportOf } = await import(new URL('ast-metrics-architecture-report.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  architectureReportOf(sources: { readonly base: Snapshot; readonly head: Snapshot; readonly touched: readonly string[] }): string;
};

function reportOf(base: Snapshot, head: Snapshot, touched: readonly string[] = []): string {
  return architectureReportOf({ base, head, touched });
}

function graphLines(report: string, pattern: RegExp): string[] {
  return report.split('\n').filter((line) => pattern.test(line));
}

const nodeLines = (report: string): string[] => graphLines(report, /^ {2}c_\w+\["/);
const edgeLines = (report: string): string[] => graphLines(report, /^ {2}c_\w+ (--|-\.|==) /);
const summaryOf = (report: string): string => report.split('\n')[2];

test('Given a head community with 2 of the 4 files of a base community, and one with 1 of 3 files of another, when the report is made, then the overlap of 0.5 matches and the overlap of 1/3 gives one new and one gone community', () => {
  const base = snapshotOf([community('0', 'kept', { count: 4 }), community('1', 'old', { count: 3 })]);
  const head = snapshotOf([community('5', 'kept', { members: ['src/kept/0.ts', 'src/kept/1.ts'] }), community('6', 'young', { members: ['src/old/0.ts'] })]);

  const report = reportOf(base, head);

  assert.deepEqual(nodeLines(report), [
    '  c_kept["kept<br/>2 files ↓2 · paths 10"]',
    '  c_old["old · gone<br/>3 files · paths 10"]',
    '  c_young["young · new<br/>1 file · paths 10"]',
  ]);
  assert.equal(summaryOf(report), 'Modularity 0.50 → 0.50 · cross share 0.25 → 0.25 · cycles 0 → 0 · communities 2 → 2 (1 new, 1 gone)');
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

  assert.ok(report.endsWith('\n\nThe map did not change.\n'), report);
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

    assert.equal(report.includes('```mermaid\n'), changed, report);
    assert.equal(report.endsWith('\n\nThe map did not change.\n'), !changed, report);
  });
}

test('Given a gone dependency between two matched communities, when the report is made, then its edge is dashed with gone and a grey link style', () => {
  const report = reportOf(snapshotOf(pair([toB])), snapshotOf(pair()));

  assert.deepEqual(edgeLines(report), ['  c_a -. "gone" .-> c_b']);
  assert.deepEqual(graphLines(report, /linkStyle/), ['  linkStyle 0 stroke:#999999,stroke-dasharray:4 4']);
});
