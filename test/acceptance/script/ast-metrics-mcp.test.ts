import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { astMetricsMcpFakeOnPath, knownFile, unscoredFile } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsMcpScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// The double ignores the files of the root, so an empty git repository is enough.
function temporaryRepository(t: TestContext): string {
  const root = dataDirectory(t);
  execFileSync('git', ['init', '--quiet', root]);
  mkdirSync(join(root, 'src'));
  return root;
}

function pathWithoutAstMetrics(): string {
  return (process.env.PATH ?? '').split(delimiter)
    .filter((folder) => folder !== '' && !existsSync(join(folder, 'ast-metrics')))
    .join(delimiter);
}

const knownFileLines = [
  'src/known.ts: score 50.2, 33 decision paths, 4 functions',
  '  score  paths  lines  name',
  '    0.0      1      1  (anonymous)',
  '   50.1      4     26  showProductAccess',
  '   61.4      5     13  initializePortal',
  '   89.5      1     20  renderSignedOut',
];

test('Given the double on PATH and the known file, when file runs from a subfolder of the root, then it prints the functions by score ascending', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, astMetricsMcpScript, ['file', 'known.ts'], { cwd: join(root, 'src'), env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, `${knownFileLines.join('\n')}\n`);
  assert.equal(result.stderr, '');
  assert.deepEqual(fake.calls(), [{ tool: 'get_file_metrics', arguments: { path: knownFile }, cwd: realpathSync(root) }]);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given --json and an absolute path, when file runs, then it prints the answer of the server as pretty JSON', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t);
  // On macOS the temporary folder is a symbolic link, and git names the root by its physical path.
  const result = await runScript(t, astMetricsMcpScript, ['file', join(root, knownFile), '--json'], { cwd: root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  const answer = JSON.parse(result.stdout) as { path: string; functions: { name: string }[] };
  assert.equal(result.stdout, `${JSON.stringify(answer, null, 2)}\n`);
  assert.equal(answer.path, knownFile);
  assert.deepEqual(answer.functions.map((entry) => entry.name), ['initializePortal', 'showProductAccess', '', 'renderSignedOut']);
  assert.deepEqual(fake.calls().map((call) => call.arguments), [{ path: knownFile }]);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given an answer without a file score, when file runs, then the header gives no score', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, astMetricsMcpScript, ['file', unscoredFile], { cwd: root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, `${[`${unscoredFile}: 33 decision paths, 4 functions`, ...knownFileLines.slice(1)].join('\n')}\n`);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given a path that the server does not know, when file runs, then it fails with the text of the server', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, astMetricsMcpScript, ['file', 'src/missing.ts'], { cwd: root, env: fake.env });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'ast-metrics-mcp: get_file_metrics failed: File not found in analysis: src/missing.ts\n');
  assert.deepEqual(fake.calls().map((call) => call.arguments), [{ path: 'src/missing.ts' }]);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given a path outside the root, when file runs, then it fails and starts no server', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, astMetricsMcpScript, ['file', '../elsewhere.ts'], { cwd: root, env: fake.env });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^ast-metrics-mcp: The path must name a file in the repository root \/.+\.\n$/);
  assert.deepEqual(fake.requests(), []);
});

for (const [args, tool, toolArguments] of [
  [['complex', '--limit', '3', '--max-cyclomatic', '15'], 'find_complex_code', { limit: 3, max_cyclomatic: 15 }],
  [['risky', '--limit', '2'], 'find_risky_code', { limit: 2 }],
  [['overview'], 'analyze_project', {}],
] as const) {
  test(`Given ${args.join(' ')}, when the command runs, then ${tool} gets the options and the answer is printed as pretty JSON`, { timeout: 10_000 }, async (t) => {
    const root = temporaryRepository(t);
    const fake = astMetricsMcpFakeOnPath(t);
    const result = await runScript(t, astMetricsMcpScript, args, { cwd: root, env: fake.env });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, `${JSON.stringify({ tool, arguments: toolArguments }, null, 2)}\n`);
    assert.deepEqual(fake.calls(), [{ tool, arguments: toolArguments, cwd: realpathSync(root) }]);
    assert.deepEqual(await fake.stillRunning(), []);
  });
}

test('Given tools, when the command runs, then it lists each tool of the server with its description', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, astMetricsMcpScript, ['tools'], { cwd: root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  const lines = result.stdout.split('\n');
  assert.equal(lines.pop(), '');
  assert.deepEqual(lines.map((line) => line.slice(0, line.indexOf(': '))), [
    'analyze_project', 'find_complex_code', 'find_risky_code', 'get_communities', 'get_coupling',
    'get_dependencies', 'get_file_metrics', 'get_test_quality', 'list_components',
  ]);
  assert.ok(lines.includes('get_file_metrics: Get detailed metrics for a specific file.'), result.stdout);
  assert.deepEqual(fake.requests().map((request) => request.method), ['initialize', 'tools/list']);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given call with a JSON object, when the command runs, then the tool gets the object unchanged', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, astMetricsMcpScript, ['call', 'find_risky_code', '{"limit":1,"min_risk":0.5}'], { cwd: root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, `${JSON.stringify({ tool: 'find_risky_code', arguments: { limit: 1, min_risk: 0.5 } }, null, 2)}\n`);
  assert.deepEqual(fake.calls().map((call) => call.arguments), [{ limit: 1, min_risk: 0.5 }]);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given a tool that answers plain text, when call runs without arguments, then it prints the text as it is', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t, { text: 'No components.' });
  const result = await runScript(t, astMetricsMcpScript, ['call', 'list_components'], { cwd: root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'No components.\n');
  assert.deepEqual(fake.calls().map((call) => call.arguments), [{}]);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given an unknown tool, when call runs, then it fails with the message of the server', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, astMetricsMcpScript, ['call', 'no_such_tool'], { cwd: root, env: fake.env });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, "ast-metrics-mcp: ast-metrics refused the request: tool 'no_such_tool' not found: tool not found\n");
  assert.deepEqual(fake.calls().map((call) => call.tool), ['no_such_tool']);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given a server that does not answer, when the deadline passes, then the command stops the server and reports the timeout', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t, { mode: 'hang' });
  const started = performance.now();
  const result = await runScript(t, astMetricsMcpScript, ['file', knownFile, '--timeout-ms', '300'], { cwd: root, env: fake.env });
  const elapsed = Math.round(performance.now() - started);
  assert.ok(elapsed < 5_000, `The command took ${elapsed} ms.`);
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'ast-metrics-mcp: The call timed out after 300 ms. Increase --timeout-ms if needed.\n');
  assert.equal(fake.calls().length, 1);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given a server that exits before it answers, when the command runs, then it fails with the stderr of the server', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const fake = astMetricsMcpFakeOnPath(t, { mode: 'exit-early' });
  const result = await runScript(t, astMetricsMcpScript, ['overview'], { cwd: root, env: fake.env });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'ast-metrics-mcp: ast-metrics exited before it answered. Its stderr: ast-metrics fake: exit before the answer\n');
  assert.deepEqual(fake.requests().map((request) => request.method), ['initialize']);
  assert.deepEqual(await fake.stillRunning(), []);
});

test('Given a PATH without ast-metrics, when the command runs, then it fails and names ast-metrics and its guide', { timeout: 10_000 }, async (t) => {
  const root = temporaryRepository(t);
  const result = await runScript(t, astMetricsMcpScript, ['overview'], { cwd: root, env: { PATH: pathWithoutAstMetrics() } });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'ast-metrics-mcp: ast-metrics is not installed, or it is not on PATH. See docs/implementation/ast-metrics-review.md.\n');
});
