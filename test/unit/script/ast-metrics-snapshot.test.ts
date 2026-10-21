import type { FileMeasurement as Measurement, Snapshot as BuiltSnapshot } from '../../../script/code-quality/snapshot/types.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// An empty PATH has no git and no ast-metrics. Thus these cases also show that the command checks its arguments first.
const noTools = { env: { PATH: '' } };

test('Given --help, when the snapshot command runs, then it explains the options, the default files of the working tree and of the merge base, and the exit status', async (t) => {
  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--help'], ...noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Usage: node script\/code-quality\/ast-metrics-snapshot\.ts \[--base REF\] \[--out FILE\] \[--timeout-ms MS\] \[--allow-tool-version\] \[--help\]\n/);
  const texts = ['ast-report/snapshot.json', 'src/', 'get_communities', 'get_file_metrics', 'default: 60000', 'HEAD', 'Exit status 1'];
  for (const text of [...texts, '--base REF', 'merge base', 'temporary worktree', 'ast-report/snapshot-base.json', 'interrupted runs', 'SIGTERM', 'Exit status 130', '143']) {
    assert.ok(result.stdout.includes(text), `The help does not name ${text}.`);
  }
});

for (const [args, diagnostic] of [
  [['--verbose'], 'Invalid arguments. Use --help for the supported options.'],
  [['snapshot.json'], 'Invalid arguments. Use --help for the supported options.'],
  [['--out'], 'Invalid arguments. Use --help for the supported options.'],
  [['--out='], 'The --out value must name a file.'],
  [['--timeout-ms', '99'], 'The --timeout-ms value must be an integer from 100 to 300000.'],
  [['--timeout-ms', '300001'], 'The --timeout-ms value must be an integer from 100 to 300000.'],
  [['--timeout-ms', '1e3'], 'The --timeout-ms value must be an integer from 100 to 300000.'],
  [['--base'], 'Invalid arguments. Use --help for the supported options.'],
  [['--base='], 'The --base value must name a git ref.'],
  [['--base=--output=diff.txt'], 'The --base value must name a git ref.'],
] as const) {
  test(`Given the arguments ${args.join(' ')}, when the snapshot command runs, then it fails with one diagnostic line`, async (t) => {
    const result = await runScript(t, astMetricsSnapshotScript, { args, ...noTools });

    assert.equal(result.stderr, `ast-metrics-snapshot: ${diagnostic}\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

// The build of the snapshot is pure, so the cases below call it in the test process. Its module runs from source next to
// the command, as the command runs it. The cases use the production types.
const { snapshotOf } = await import(new URL('snapshot/build.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/snapshot/build.ts');
const { sourceFilesOf } = await import(new URL('snapshot/input.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/snapshot/input.ts');

test('Given absent native file MI, when a snapshot is built, then both MI fields stay absent', () => {
  for (const fields of [{}, { maintainability: {} }]) {
    const [file] = sourceFilesOf(JSON.stringify({ concernedFiles: [{ path: '/repo/src/value.ts', ...fields }] }), '/repo');
    assert.equal(file.maintainability, undefined);
    assert.deepEqual(snapshotFor([file], {}).files[0], { path: 'src/value.ts', community: null, paths: 0, loc: 0, functions: [] });
  }
});

test('Given finite native file MI, when a snapshot is built, then zero and full precision remain raw while the old field stays rounded', () => {
  for (const value of [0, 84.96, 56.17474697614129, 128.00000001, -3.14159]) {
    const [file] = sourceFilesOf(JSON.stringify({ concernedFiles: [{ path: '/repo/src/value.ts', maintainability: { maintainabilityIndex: value } }] }), '/repo');
    assert.equal(file.maintainability, value);
    assert.deepEqual(snapshotFor([file], {}).files[0], {
      path: 'src/value.ts', community: null, maintainability: Number(value.toFixed(1)), maintainabilityRaw: value, paths: 0, loc: 0, functions: [],
    });
  }
});

test('Given malformed or nonfinite native file MI, when the report is read, then a path-specific error rejects it', () => {
  for (const value of ['null', '[]', '4', '"84.96"', '{"maintainabilityIndex":null}', '{"maintainabilityIndex":"84.96"}', '{"maintainabilityIndex":true}', '{"maintainabilityIndex":[]}', '{"maintainabilityIndex":{}}', '{"maintainabilityIndex":1e999}', '{"maintainabilityIndex":-1e999}']) {
    const report = `{"concernedFiles":[{"path":"/repo/src/value.ts","maintainability":${value}}]}`;
    assert.throws(() => sourceFilesOf(report, '/repo'), { message: 'Invalid file maintainability for src/value.ts: expected an object with an optional finite maintainabilityIndex.' }, value);
  }
});

test('Given malformed MI outside src and malformed unrelated source metrics, when the report is read, then only source file MI has the new validation', () => {
  const report = { concernedFiles: [
    { path: '/repo/test/value.ts', maintainability: null },
    { path: '/repo/script/value.ts', maintainability: { maintainabilityIndex: 'invalid' } },
    { path: '/elsewhere/value.ts', maintainability: [] },
    { path: '/repo/src/value.ts', complexity: { cyclomatic: 'invalid' }, volume: { loc: 'invalid' }, risk: { score: 'invalid' } },
  ] };
  assert.deepEqual(sourceFilesOf(JSON.stringify(report), '/repo'), [{ path: 'src/value.ts', paths: 0, loc: 0, maintainability: undefined, risk: undefined }]);
});

// A community of the get_communities answer, with its members as hubs.
function community(id: string, members: readonly string[], namespaces: Readonly<Record<string, number>> = {}) {
  return { id, hubs: members, members, namespaces: Object.entries(namespaces).map(([namespace, count]) => ({ namespace, count })) };
}

const edge = (from: string, to: string, inCycle: boolean) => ({ from, to, references: 1, inCycle });

// The snapshot as its JSON gives it. Each file has an answer of get_file_metrics without functions, unless the case
// gives the answers.
function snapshotFor(files: readonly Measurement[], answer: object, functions?: ReadonlyMap<string, string>): BuiltSnapshot {
  const answers = functions ?? new Map(files.map(({ path }) => [path, '{}']));
  const sources = { commit: 'c0ffee', date: '2026-10-18T00:00:00-06:00', files, communities: JSON.stringify(answer), functions: answers };
  return JSON.parse(JSON.stringify(snapshotOf(sources))) as BuiltSnapshot;
}

test('Given files with and without a maintainability index, when the snapshot is built, then the maintainability of a community and of src/ is the sum of index × lines over the sum of lines of the files with an index', () => {
  const files = [
    { path: 'src/a/large.ts', paths: 3, loc: 100, maintainability: 60 },
    { path: 'src/a/small.ts', paths: 1, loc: 50, maintainability: 90 },
    { path: 'src/a/types.ts', paths: 0, loc: 30 },
    { path: 'src/b/types.ts', paths: 0, loc: 5 },
  ];
  const snapshot = snapshotFor(files, { communities: [community('0', ['src/a/large', 'src/a/small', 'src/a/types'], { 'src/a': 3 }), community('1', ['src/b/types'], { 'src/b': 1 })] });

  assert.deepEqual(snapshot.communities.map(({ label, loc, paths, maintainability }) => ({ label, loc, paths, maintainability })), [
    { label: 'a', loc: 180, paths: 4, maintainability: 70 },
    { label: 'b', loc: 5, paths: 0, maintainability: undefined },
  ]);
  assert.equal(snapshot.global.maintainability, 70);
});

test('Given the namespaces of the communities, when the snapshot is built, then a label is the largest namespace in src/ without the prefix, a tie goes to the first name, the top folder stays src, and the shared kernel is shared kernel', () => {
  const snapshot = snapshotFor([], {
    communities: [
      community('0', ['src/mcp/tools', 'src/http/server'], { 'src/mcp': 2, 'src/http': 2, src: 1 }),
      community('1', ['src/application', 'src/index', 'src/http/routes'], { src: 2, 'src/http': 1 }),
      community('2', ['script/a', 'script/b', 'src/tools/cli'], { script: 2, 'src/tools': 1 }),
      community('shared', ['src/organizations/overviews'], { 'src/organizations': 1 }),
    ],
  });

  assert.deepEqual(snapshot.communities.map(({ id, label }) => [id, label]), [['0', 'http'], ['shared', 'shared kernel'], ['1', 'src'], ['2', 'tools']]);
});

test('Given two communities with the same largest namespace, when the snapshot is built, then each label carries the basename of its hub, also for a hub that is a folder', () => {
  const snapshot = snapshotFor([], {
    communities: [community('0', ['src/auth/hosted-auth', 'src/auth/access'], { 'src/auth': 2 }), community('1', ['src/auth/local-auth'], { 'src/auth': 1 })],
  });

  assert.deepEqual(snapshot.communities.map(({ label }) => label), ['auth (hosted-auth)', 'auth (local-auth)']);
});

test('Given a community without a member in src/, when the snapshot is built, then it, its edges, and each cycle through it are absent, and a cycle lists the sorted labels of its communities', () => {
  const snapshot = snapshotFor([], {
    communities: [community('0', ['src/b/x'], { 'src/b': 1 }), community('1', ['src/a/y'], { 'src/a': 1 }), community('2', ['script/z'], { script: 1 })],
    edges: [edge('0', '1', true), edge('1', '0', true), edge('1', '2', true), edge('2', '1', true)],
    cycles: [['0', '1'], ['1', '2']],
  });

  assert.deepEqual(snapshot.communities.map(({ label, edges }) => [label, edges.map(({ to }) => to)]), [['a', ['0']], ['b', ['1']]]);
  assert.deepEqual(snapshot.global.cycles, [['a', 'b']]);
});

test('Given files in a folder unit, in a file unit, and in no community, when the snapshot is built, then each file names the community of the nearest unit that holds it, or null', () => {
  const files = ['src/auth/hosted-auth/workos/signup.ts', 'src/http/server-options.ts', 'src/http/server.ts', 'src/index.ts'].map((path) => ({ path, paths: 1, loc: 10 }));
  const snapshot = snapshotFor(files, { communities: [community('0', ['src/auth/hosted-auth'], { 'src/auth': 1 }), community('1', ['src/http/server'], { 'src/http': 1 })] });

  assert.deepEqual(snapshot.files.map(({ path, community: id }) => [path, id]), [
    ['src/auth/hosted-auth/workos/signup.ts', '0'], ['src/http/server-options.ts', null], ['src/http/server.ts', '1'], ['src/index.ts', null],
  ]);
  assert.deepEqual(snapshot.communities.map(({ members }) => members), [['src/auth/hosted-auth/workos/signup.ts'], ['src/http/server.ts']]);
});

test('Given the answers of get_file_metrics, when the snapshot is built, then each file has its functions in order, an empty name is (anonymous), a value that the answer leaves out is absent, and the numbers are rounded', () => {
  const files = [{ path: 'src/a.ts', paths: 3, loc: 40, maintainability: 61.249, risk: 0.256 }, { path: 'src/b.ts', paths: 0, loc: 4 }];
  const functions = new Map([
    ['src/a.ts', JSON.stringify({ functions: [
      { name: 'first', cyclomatic_complexity: 2, maintainability: { maintainability_index: 61.449 }, volume: { loc: 13 } },
      { name: '', cyclomatic_complexity: 1, volume: { loc: 1 } },
    ] })],
    ['src/b.ts', JSON.stringify({ cyclomatic_complexity: 0 })],
  ]);
  const snapshot = snapshotFor(files, { communities: [] }, functions);

  assert.deepEqual(snapshot.files.map(({ path, maintainability, risk, functions: entries }) => ({ path, maintainability, risk, entries })), [
    { path: 'src/a.ts', maintainability: 61.2, risk: 0.26, entries: [{ name: 'first', paths: 2, maintainability: 61.4, loc: 13 }, { name: '(anonymous)', paths: 1, loc: 1 }] },
    { path: 'src/b.ts', maintainability: undefined, risk: undefined, entries: [] },
  ]);
  assert.equal(snapshot.global.functions, 2);
});

for (const [name, functions, communities, message] of [
  ['a file without an answer of get_file_metrics', new Map<string, string>(), '{}', 'get_file_metrics gave no answer for src/a.ts.'],
  ['an answer of get_file_metrics that is not JSON', new Map([['src/a.ts', 'File metrics']]), '{}', 'get_file_metrics gave an unexpected answer for src/a.ts: expected a JSON object.'],
  ['an answer of get_communities that is not a JSON object', new Map([['src/a.ts', '{}']]), '[]', 'get_communities gave an unexpected answer: expected a JSON object.'],
] as const) {
  test(`Given ${name}, when the snapshot is built, then the build fails with a message that names it`, () => {
    const sources = { commit: 'c0ffee', date: '2026-10-18T00:00:00-06:00', files: [{ path: 'src/a.ts', paths: 1, loc: 1 }], communities, functions };

    assert.throws(() => snapshotOf(sources), { message });
  });
}
