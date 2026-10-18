// A fake of "ast-metrics mcp", the MCP server of the ast-metrics CLI 0.43.1. Like the real server, it reads one
// JSON-RPC message per line on stdin, writes one per line on stdout, and exits at the end of its input. It has the
// nine tools of the real server, but it reads no file: get_file_metrics knows two paths, and each other tool answers
// JSON that echoes its arguments, so that a test can see what the command sent. A file of answers replaces the two
// paths and the echo of get_communities. Like the real server, it takes the folder to analyze as an optional argument
// after mcp; it gives the same answers for each folder, and the request log names the folder.
//
// Settings in the environment:
//   AST_METRICS_FAKE_REQUEST_LOG   A file that gets one JSON line for each request: method, tool, arguments, folder,
//                                  pid, cwd. A server without a folder argument logs no folder.
//                                  The name differs from the call log of ast-metrics-cli-fake.ts, which runs this fake
//                                  for its mcp command in one environment with its own settings.
//   AST_METRICS_FAKE_ANSWERS       A JSON file with the answer of get_communities, and the answers of get_file_metrics
//                                  by path. get_file_metrics then knows only these paths.
//   AST_METRICS_FAKE_HANG=1        Never answer a tools/call, and keep running after the end of the input.
//   AST_METRICS_FAKE_EXIT_EARLY=1  Exit with status 3 right after the answer to initialize.
//   AST_METRICS_FAKE_TEXT          Plain text that each tool other than get_file_metrics answers instead of JSON.
import { appendFileSync, readFileSync } from 'node:fs';
import { createInterface, type Interface } from 'node:readline';

type JsonObject = Readonly<Record<string, unknown>>;

const settings = {
  folder: process.argv[3],
  log: process.env.AST_METRICS_FAKE_REQUEST_LOG,
  hang: process.env.AST_METRICS_FAKE_HANG === '1',
  exitEarly: process.env.AST_METRICS_FAKE_EXIT_EARLY === '1',
  text: process.env.AST_METRICS_FAKE_TEXT,
};

const tools = [
  ['analyze_project', 'Analyze the project and return a high-level overview.'],
  ['find_complex_code', 'Find functions and classes with high cyclomatic complexity or low maintainability index.'],
  ['find_risky_code', 'Find files and classes with the highest risk scores.'],
  ['get_communities', 'Get the communities of the project.'],
  ['get_coupling', 'Get coupling analysis for a specific component.'],
  ['get_dependencies', 'Get the dependency graph for a package or component.'],
  ['get_file_metrics', 'Get detailed metrics for a specific file.'],
  ['get_test_quality', 'Get test quality metrics.'],
  ['list_components', 'List all components (packages, classes, files) found in the project.'],
].map(([name, description]) => ({ name, description, inputSchema: { type: 'object' } }));

// A trimmed copy of the answer of ast-metrics 0.43.1 for src/user-portal/portal.ts: the file values and four of its
// ten functions. The anonymous function comes from another real answer.
const knownMetrics = {
  coupling: { afferent: 1, efferent: 2, instability: 0.6666666666666666 },
  cyclomatic_complexity: 33,
  functions: [
    {
      cyclomatic_complexity: 5,
      maintainability: { comment_weight: 0, maintainability_index: 61.410442151017776, maintainability_index_without_comments: 61.410442151017776 },
      name: 'initializePortal',
      volume: { cloc: 0, halstead_bugs: 0.09230163890742386, halstead_difficulty: 10.733333333333333, halstead_effort: 2972.112772819048, halstead_volume: 276.9049167222716, lloc: 9, loc: 13 },
    },
    {
      cyclomatic_complexity: 4,
      maintainability: { comment_weight: 0, maintainability_index: 50.12605988366899, maintainability_index_without_comments: 50.12605988366899 },
      name: 'showProductAccess',
      volume: { cloc: 0, halstead_bugs: 0.2120978186292979, halstead_difficulty: 9, halstead_effort: 5726.641102991043, halstead_volume: 636.2934558878937, lloc: 23, loc: 26 },
    },
    {
      cyclomatic_complexity: 1,
      maintainability: { comment_weight: 0, maintainability_index: 0, maintainability_index_without_comments: 0 },
      name: '',
      volume: { cloc: 0, halstead_bugs: 0.009357849740192013, halstead_difficulty: 3.75, halstead_effort: 105.27580957716015, halstead_volume: 28.07354922057604, lloc: 0, loc: 1 },
    },
    {
      cyclomatic_complexity: 1,
      maintainability: { comment_weight: 0, maintainability_index: 89.52267462886361, maintainability_index_without_comments: 89.52267462886361 },
      name: 'renderSignedOut',
      volume: { cloc: 0, halstead_bugs: 0.01, halstead_difficulty: 1.8, halstead_effort: 54, halstead_volume: 30, lloc: 1, loc: 20 },
    },
  ],
  language: 'TypeScript',
  lines_of_code: { comment_lines: 4, lines_of_code: 176, logical_lines: 72 },
  maintainability: { comment_weight: 11.571614364171445, maintainability_index: 50.212352992332846, maintainability_index_without_comments: 38.6407386281614 },
  path: 'src/known.ts',
  risk_score: 0.05933681606021568,
  volume: { cloc: 4, halstead_bugs: 0.07341069249774988, halstead_difficulty: 6.856811032105149, halstead_effort: 1877.3398145414073, halstead_volume: 220.23207749324965, lloc: 72, loc: 176 },
};
const { maintainability: _fileScore, ...unscoredMetrics } = knownMetrics;
const answers = answersOf(process.env.AST_METRICS_FAKE_ANSWERS);
const fileMetrics = new Map<string, JsonObject>(isJsonObject(answers.get_file_metrics) ? answerEntries(answers.get_file_metrics) : [
  ['src/known.ts', knownMetrics],
  ['src/unscored.ts', { ...unscoredMetrics, path: 'src/unscored.ts' }],
]);

function answersOf(file: string | undefined): JsonObject {
  const value: unknown = file === undefined ? {} : JSON.parse(readFileSync(file, 'utf8'));
  return isJsonObject(value) ? value : {};
}

function answerEntries(answersByPath: JsonObject): [string, JsonObject][] {
  return Object.entries(answersByPath).filter((entry): entry is [string, JsonObject] => isJsonObject(entry[1]));
}

function send(message: JsonObject): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
}

function record(request: JsonObject): void {
  if (settings.log === undefined) return;
  const params = paramsOf(request);
  const call = request.method === 'tools/call' ? { tool: params.name, arguments: params.arguments } : {};
  appendFileSync(settings.log, `${JSON.stringify({ method: request.method, ...call, folder: settings.folder, pid: process.pid, cwd: process.cwd() })}\n`);
}

function textResult(text: string, isError: boolean): JsonObject {
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

// The texts of the real server for a missing path and for a path that it did not analyze.
function fileMetricsResult(path: unknown): JsonObject {
  if (path === undefined) return textResult('Missing required parameter: path', true);
  const metrics = typeof path === 'string' ? fileMetrics.get(path) : undefined;
  if (metrics === undefined) return textResult(`File not found in analysis: ${path}`, true);
  return { ...textResult(JSON.stringify(metrics), false), structuredContent: metrics };
}

function toolResult(name: unknown, args: unknown): JsonObject {
  if (name === 'get_file_metrics') return fileMetricsResult(isJsonObject(args) ? args.path : undefined);
  if (name === 'get_communities' && answers.get_communities !== undefined) return textResult(JSON.stringify(answers.get_communities), false);
  return textResult(settings.text ?? JSON.stringify({ tool: name, arguments: args }), false);
}

function callTool(id: unknown, params: JsonObject): void {
  if (settings.hang) {
    // A busy server. The timer keeps the process alive after the end of the input, for at most 30 seconds.
    setTimeout(() => process.exit(4), 30_000);
    return;
  }
  if (!tools.some((tool) => tool.name === params.name)) {
    send({ id, error: { code: -32602, message: `tool '${params.name}' not found: tool not found` } });
    return;
  }
  send({ id, result: toolResult(params.name, params.arguments ?? {}) });
}

function initialize(id: unknown, input: Interface): void {
  send({ id, result: { protocolVersion: '2024-11-05', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'ast-metrics', version: '0.43.1' } } });
  if (!settings.exitEarly) return;
  // Stop reading, and let Node exit after it writes the pending output. process.exit() can lose that output.
  process.stderr.write('ast-metrics fake: exit before the answer\n');
  process.exitCode = 3;
  input.close();
  process.stdin.destroy();
}

function handle(request: unknown, input: Interface): void {
  // A notification, such as notifications/initialized, gets no answer, and so does a message that is not an object.
  if (!isJsonObject(request) || request.id === undefined) return;
  record(request);
  if (request.method === 'initialize') initialize(request.id, input);
  else if (request.method === 'tools/list') send({ id: request.id, result: { tools } });
  else if (request.method === 'tools/call') callTool(request.id, paramsOf(request));
  else send({ id: request.id, error: { code: -32601, message: `method '${request.method}' not found` } });
}

function paramsOf(request: JsonObject): JsonObject {
  return isJsonObject(request.params) ? request.params : {};
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serve(): void {
  const input = createInterface({ input: process.stdin });
  input.on('line', (line) => {
    if (line.trim() === '') return;
    let request: unknown;
    try {
      request = JSON.parse(line);
    } catch {
      send({ id: null, error: { code: -32700, message: 'parse error' } });
      return;
    }
    handle(request, input);
  });
}

if (process.argv[2] === 'mcp') {
  serve();
} else {
  process.stderr.write('ast-metrics fake: only the mcp command is available\n');
  process.exitCode = 2;
}
