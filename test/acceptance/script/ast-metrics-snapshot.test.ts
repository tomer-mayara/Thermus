import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { communitiesAnswer, communityOf, repositoryFiles, serverAnswers, snapshotDoublesOnPath, sourceFiles } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The snapshot of the working tree and its rules. ast-metrics-snapshot-failures.test.ts specifies the failures.
const timeout = 20_000;

// The parts of the snapshot that the rule cases read.
interface SnapshotParts {
  readonly global: { readonly cycles: readonly (readonly string[])[] };
  readonly communities: readonly { readonly id: string; readonly label: string; readonly members: readonly string[]; readonly edges: readonly { readonly to: string }[] }[];
  readonly files: readonly { readonly path: string; readonly community: string | null }[];
}

function committedRepository(t: TestContext): GitRepository {
  const repository = GitRepository.create(t);
  repository.commit('Add the files', repositoryFiles);
  return repository;
}

function snapshotIn(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// The maintainability of src/ is the sum of index × lines over the sum of lines of the files with an index:
// (61.24 × 100 + 88.8 × 50 + 70.06 × 50) / 200 = 70.335, so 70.3. The plain mean of the three files is 73.4, and with
// src/kernel/ids.ts (no index, 10 lines) as zero it is 67.0. For auth: (61.24 × 100 + 88.8 × 50) / 150 = 70.43.
const expectedSnapshot = {
  version: 1,
  global: { modularity: 0.42, crossShare: 0.33, cycles: [['admin', 'auth']], maintainability: 70.3, paths: 13, files: 4, functions: 5 },
  communities: [
    {
      id: '1', label: 'admin', hub: 'src/admin/pages', members: ['src/admin/pages/account.ts'], files: 1, loc: 50, maintainability: 70.1, paths: 4,
      references: { internal: 0, inbound: 2, outbound: 2 },
      edges: [{ to: '0', references: 1, inCycle: true }, { to: 'shared', references: 1, inCycle: false }],
    },
    {
      id: '0', label: 'auth', hub: 'src/auth/session', members: ['src/auth/session.ts', 'src/auth/tokens.ts'], files: 2, loc: 150, maintainability: 70.4, paths: 9,
      references: { internal: 5, inbound: 2, outbound: 4 },
      edges: [{ to: '1', references: 2, inCycle: true }, { to: 'shared', references: 2, inCycle: false }],
    },
    {
      id: 'shared', label: 'shared kernel', hub: 'src/kernel/ids', members: ['src/kernel/ids.ts'], files: 1, loc: 10, paths: 0,
      references: { internal: 0, inbound: 3, outbound: 0 },
      edges: [],
    },
  ],
  files: [
    { path: 'src/admin/pages/account.ts', community: '1', maintainability: 70.1, paths: 4, loc: 50, risk: 0.1, functions: [{ name: 'renderAccount', paths: 4, maintainability: 59, loc: 25 }] },
    {
      path: 'src/auth/session.ts', community: '0', maintainability: 61.2, paths: 6, loc: 100, risk: 0.26,
      functions: [{ name: 'openSession', paths: 4, maintainability: 65.4, loc: 20 }, { name: '(anonymous)', paths: 1, maintainability: 88.9, loc: 3 }, { name: 'closeSession', paths: 1, loc: 2 }],
    },
    { path: 'src/auth/tokens.ts', community: '0', maintainability: 88.8, paths: 3, loc: 50, functions: [{ name: 'issueToken', paths: 3, maintainability: 72.1, loc: 12 }] },
    { path: 'src/kernel/ids.ts', community: 'shared', paths: 0, loc: 10, functions: [] },
  ],
};

test('Given the doubles with the answers of a small repository, when the snapshot runs, then ast-report/snapshot.json holds the src/ communities, the LOC-weighted maintainability, each file with its functions, and the commit and date of HEAD, from one analysis and one MCP session', { timeout }, async (t) => {
  const repository = committedRepository(t);
  const doubles = snapshotDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'Wrote ast-report/snapshot.json: 3 communities, 4 files, 5 functions.\n');
  assert.equal(result.code, 0);
  const { commit, date, provenance, ...snapshot } = snapshotIn(join(repository.root, 'ast-report', 'snapshot.json')) as { readonly commit: string; readonly date: string; readonly provenance: unknown };
  assert.ok(provenance);
  assert.deepEqual(snapshot, expectedSnapshot);
  assert.deepEqual({ commit, date }, { commit: repository.git('rev-parse', 'HEAD').trim(), date: repository.git('show', '-s', '--format=%cI', 'HEAD').trim() });
  assert.deepEqual(doubles.server.calls(), [
    { tool: 'get_communities', arguments: { with_members: true }, cwd: repository.root },
    ...sourceFiles.map((path) => ({ tool: 'get_file_metrics', arguments: { path }, cwd: repository.root })),
  ]);
  const requests = doubles.server.requests();
  assert.deepEqual([requests.filter((request) => request.method === 'initialize').length, new Set(requests.map((request) => request.pid)).size], [1, 1]);
  assert.deepEqual(await doubles.server.stillRunning(), []);
});

// ast-metrics groups the dependency graph of all that it analyzes, so code that grows in script/ or test/ would regroup
// the communities of src/.
test('Given the doubles, when the snapshot runs, then the analysis and the MCP server get the folder src, in the repository root, so that code outside src/ cannot regroup its communities', { timeout }, async (t) => {
  const repository = committedRepository(t);
  const doubles = snapshotDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  const [analysis, session, ...otherCalls] = doubles.cli.calls();
  assert.deepEqual(otherCalls, []);
  assert.match(analysis.argv[1], /^--report-json=\/.+\/report\.json$/);
  assert.deepEqual([analysis.argv.toSpliced(1, 1), analysis.cwd], [['analyze', '--report-summary=false', 'src'], repository.root]);
  assert.equal(existsSync(analysis.argv[1].slice('--report-json='.length)), false, 'The JSON report stays after the run.');
  assert.deepEqual(session, { argv: ['mcp', 'src'], cwd: repository.root });
  assert.deepEqual([...new Set(doubles.server.requests().map(({ folder }) => folder))], ['src']);
});

test('Given a script/ community in a cycle with a src/ community, when the snapshot runs, then the snapshot has neither that community, nor its edges, nor its cycle', { timeout }, async (t) => {
  const repository = committedRepository(t);
  const communities = {
    ...communitiesAnswer,
    cycles: [['0', '1'], ['0', '2']],
    edges: [...communitiesAnswer.edges, { from: '0', to: '2', references: 1, inCycle: true, back: true, shared: false }],
  };
  const doubles = snapshotDoublesOnPath(t, { server: { ...serverAnswers, get_communities: communities } });

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  const snapshot = snapshotIn(join(repository.root, 'ast-report', 'snapshot.json')) as SnapshotParts;
  assert.deepEqual(snapshot.communities.map(({ id, label }) => [id, label]), [['1', 'admin'], ['0', 'auth'], ['shared', 'shared kernel']]);
  assert.deepEqual(snapshot.communities.flatMap(({ edges }) => edges.map(({ to }) => to)), ['0', 'shared', '1', 'shared']);
  assert.deepEqual(snapshot.communities.flatMap(({ members }) => members).filter((member) => !member.startsWith('src/')), []);
  assert.deepEqual(snapshot.global.cycles, [['admin', 'auth']]);
  assert.deepEqual(snapshot.files.map(({ path }) => path), sourceFiles);
});

test('Given two communities with the same largest namespace, when the snapshot runs, then each label carries the basename of its hub', { timeout }, async (t) => {
  const repository = committedRepository(t);
  const [, admin, script, kernel] = communitiesAnswer.communities;
  const references = { internalReferences: 0, inboundReferences: 1, outboundReferences: 1 };
  const communities = {
    ...communitiesAnswer,
    communities: [
      { ...communityOf('0', ['src/auth/session'], { 'src/auth': 1 }), name: 'src (src/auth/session)', ...references },
      { ...communityOf('3', ['src/auth/tokens'], { 'src/auth': 1 }), name: 'src (src/auth/tokens)', ...references },
      admin, script, kernel,
    ],
  };
  const doubles = snapshotDoublesOnPath(t, { server: { ...serverAnswers, get_communities: communities } });

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  const snapshot = snapshotIn(join(repository.root, 'ast-report', 'snapshot.json')) as SnapshotParts;
  assert.deepEqual(snapshot.communities.map(({ id, label }) => [id, label]), [['1', 'admin'], ['0', 'auth (session)'], ['3', 'auth (tokens)'], ['shared', 'shared kernel']]);
  assert.deepEqual(snapshot.global.cycles, [['admin', 'auth (session)']]);
  assert.deepEqual(snapshot.files.map(({ path, community }) => [path, community]), [
    ['src/admin/pages/account.ts', '1'], ['src/auth/session.ts', '0'], ['src/auth/tokens.ts', '3'], ['src/kernel/ids.ts', 'shared'],
  ]);
});

// A shell gives PWD the path through the link. ast-metrics, a Go program, then writes paths through the link, unless
// the command gives it the root in PWD; then no path of the report would be in the root.
test('Given a caller in the repository through a symbolic link, when the snapshot runs, then the snapshot still holds each src/ file of the report', { timeout }, async (t) => {
  const repository = committedRepository(t);
  const link = repository.linkToRoot(t);
  const doubles = snapshotDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: link, env: { ...doubles.env, PWD: link } });

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual((snapshotIn(join(repository.root, 'ast-report', 'snapshot.json')) as SnapshotParts).files.map(({ path }) => path), sourceFiles);
});

test('Given --out with a path in a new folder, when the snapshot runs from a subfolder, then the snapshot goes to that path, relative to the current folder, and not to ast-report/', { timeout }, async (t) => {
  const repository = committedRepository(t);
  const doubles = snapshotDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--out', '../reports/new/snapshot.json'], cwd: join(repository.root, 'src'), env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'Wrote ../reports/new/snapshot.json: 3 communities, 4 files, 5 functions.\n');
  assert.equal(result.code, 0);
  assert.deepEqual((snapshotIn(join(repository.root, 'reports', 'new', 'snapshot.json')) as SnapshotParts).files.map(({ path }) => path), sourceFiles);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});
