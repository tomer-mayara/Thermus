import type { TestContext } from 'node:test';
import { astMetricsCliFakeOnPath, type AstMetricsCliAnswers, type AstMetricsCliFake } from '../../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsMcpFakeOnPath, type AstMetricsMcpAnswers, type AstMetricsMcpFakeOnPath } from '../../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';

// The answers of ast-metrics 0.43.1 for a small repository, in the shapes of the real answers. Two communities of src/
// depend on each other in a cycle: auth ("0") with two files, and admin ("1"), whose member is a folder, because
// ast-metrics groups the files of a deep folder into one unit. Both use the shared kernel. script/ is a community of
// its own ("2"), and the test file is in no community. Like the real answers, a JSON report leaves out each zero value,
// and a file of types has no maintainability index.

export const sourceFiles = ['src/admin/pages/account.ts', 'src/auth/session.ts', 'src/auth/tokens.ts', 'src/kernel/ids.ts'];

export const repositoryFiles: Readonly<Record<string, string>> = Object.fromEntries(
  [...sourceFiles, 'script/tool.ts', 'test/session.test.ts'].map((path) => [path, 'export const value = 1;\n']),
);

// The files of the JSON report of "ast-metrics analyze", not sorted. {root} stands for the working directory.
const reportFiles = [
  { path: '{root}/src/auth/session.ts', complexity: { cyclomatic: 6 }, volume: { loc: 100, lloc: 40 }, maintainability: { maintainabilityIndex: 61.24 }, risk: { score: 0.256 }, coupling: { afferent: 2, efferent: 3 } },
  { path: '{root}/script/tool.ts', complexity: { cyclomatic: 2 }, volume: { loc: 20 }, maintainability: { maintainabilityIndex: 80 }, risk: {}, coupling: { efferent: 1 } },
  { path: '{root}/src/admin/pages/account.ts', complexity: { cyclomatic: 4 }, volume: { loc: 50 }, maintainability: { maintainabilityIndex: 70.06 }, risk: { score: 0.1 }, coupling: { efferent: 2 } },
  { path: '{root}/test/session.test.ts', complexity: { cyclomatic: 1 }, volume: { loc: 30 }, maintainability: { maintainabilityIndex: 40 }, risk: {}, coupling: { efferent: 1 } },
  { path: '{root}/src/kernel/ids.ts', complexity: {}, volume: { loc: 10 }, maintainability: {}, risk: {}, coupling: { afferent: 3 } },
  { path: '{root}/src/auth/tokens.ts', complexity: { cyclomatic: 3 }, volume: { loc: 50 }, maintainability: { maintainabilityIndex: 88.8 }, risk: {}, coupling: { afferent: 1 } },
];

export const jsonReport = JSON.stringify({ concernedFiles: reportFiles, numberFiles: reportFiles.length, numberFunctions: 6 });

// A community whose hubs are its members. The namespaces give the count of members in each folder.
export function communityOf(id: string, members: readonly string[], namespaces: Readonly<Record<string, number>>) {
  return {
    id, size: members.length, cohesive: true, hubs: members, members,
    namespaces: Object.entries(namespaces).map(([namespace, count]) => ({ namespace, count, share: count / members.length })),
  };
}

function edgeOf(from: string, to: string, references: number) {
  return { from, to, references, inCycle: false, back: false, shared: from === 'shared' || to === 'shared' };
}

export const communitiesAnswer = {
  verdict: 'Some of these communities cannot change alone.', granularity: 'namespace', communitiesCount: 3,
  modularity: 0.4166666666666667, crossShare: 0.3333333333333333,
  cycles: [['0', '1']],
  communities: [
    { ...communityOf('0', ['src/auth/session', 'src/auth/tokens'], { 'src/auth': 2 }), name: 'src/auth', internalReferences: 5, inboundReferences: 2, outboundReferences: 4 },
    { ...communityOf('1', ['src/admin/pages'], { 'src/admin': 1 }), name: 'src/admin', internalReferences: 0, inboundReferences: 2, outboundReferences: 2 },
    { ...communityOf('2', ['script/tool'], { script: 1 }), name: 'script', internalReferences: 0, inboundReferences: 0, outboundReferences: 1 },
    { ...communityOf('shared', ['src/kernel/ids'], { 'src/kernel': 1 }), name: 'Shared kernel (src/kernel/ids)', shared: true, internalReferences: 0, inboundReferences: 3, outboundReferences: 0 },
  ],
  edges: [
    { ...edgeOf('0', '1', 2), inCycle: true },
    edgeOf('0', 'shared', 2),
    { ...edgeOf('1', '0', 1), inCycle: true, back: true },
    edgeOf('1', 'shared', 1),
    edgeOf('2', '0', 1),
  ],
};

// The values of a file differ from the JSON report, because the snapshot takes them from the report. An anonymous
// function, such as a callback, has an empty name.
function answerOf(path: string, cyclomatic: number, functions: readonly object[]) {
  return { path, language: 'TypeScript', cyclomatic_complexity: cyclomatic, risk_score: 0.5, functions };
}

export const fileMetricsAnswers: Readonly<Record<string, object>> = {
  'src/admin/pages/account.ts': answerOf('src/admin/pages/account.ts', 4, [
    { name: 'renderAccount', cyclomatic_complexity: 4, maintainability: { comment_weight: 0, maintainability_index: 58.96 }, volume: { loc: 25, lloc: 20 } },
  ]),
  'src/auth/session.ts': answerOf('src/auth/session.ts', 6, [
    { name: 'openSession', cyclomatic_complexity: 4, maintainability: { comment_weight: 0, maintainability_index: 65.43 }, volume: { loc: 20, lloc: 16 } },
    { name: '', cyclomatic_complexity: 1, maintainability: { comment_weight: 0, maintainability_index: 88.88 }, volume: { loc: 3, lloc: 1 } },
    { name: 'closeSession', cyclomatic_complexity: 1, volume: { loc: 2, lloc: 0 } },
  ]),
  'src/auth/tokens.ts': answerOf('src/auth/tokens.ts', 3, [
    { name: 'issueToken', cyclomatic_complexity: 3, maintainability: { comment_weight: 0, maintainability_index: 72.06 }, volume: { loc: 12, lloc: 9 } },
  ]),
  'src/kernel/ids.ts': answerOf('src/kernel/ids.ts', 0, []),
};

export const serverAnswers: AstMetricsMcpAnswers = { get_communities: communitiesAnswer, get_file_metrics: fileMetricsAnswers };

export interface SnapshotDoubles {
  // The env option of runScript.
  readonly env: Readonly<Record<string, string>>;
  readonly cli: AstMetricsCliFake;
  readonly server: AstMetricsMcpFakeOnPath;
}

export interface SnapshotAnswers {
  readonly cli?: AstMetricsCliAnswers;
  readonly server?: AstMetricsMcpAnswers;
}

// One ast-metrics on PATH answers both commands of the snapshot: the CLI fake answers analyze, and for mcp it runs the
// fake of the server with the server answers.
export function snapshotDoublesOnPath(t: TestContext, answers: SnapshotAnswers = {}): SnapshotDoubles {
  const server = astMetricsMcpFakeOnPath(t, { answers: answers.server ?? serverAnswers });
  const cli = astMetricsCliFakeOnPath(t, answers.cli ?? { json: jsonReport });
  return { env: { ...server.env, ...cli.env }, cli, server };
}
