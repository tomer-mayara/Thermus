#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { withAstMetricsServer } from './ast-metrics-session.mjs';
import { CommandError, repositoryRoot } from './repository.mjs';

const help = `Usage: node script/ast-metrics-mcp.mjs <subcommand> [options]

Start the MCP server of ast-metrics ("ast-metrics mcp") in the repository root,
make one call, print the answer, and stop the server.

Subcommands:
  file <path> [--json]                       get_file_metrics. The path is relative to the
                                             current folder, or absolute in the root. Prints
                                             the file score and each function, lowest score first.
  complex [--limit N] [--max-cyclomatic N]   find_complex_code, printed as JSON
  risky [--limit N]                          find_risky_code, printed as JSON
  overview                                   analyze_project, printed as JSON
  tools                                      The tools of the server and their descriptions
  call <tool> [<json arguments>]             Any tool. The arguments are a JSON object (default: {}).

Options:
  --json              file: print the answer of the server as JSON
  --limit N           complex, risky: the maximum number of results
  --max-cyclomatic N  complex: show the items above this complexity
  --timeout-ms MS     Deadline of the MCP call (100..300000; default: 60000)
  --help, -h          Show this help

The score is the maintainability index (0 to 100; more is better). The paths are the
decision paths (cyclomatic complexity), and the lines are lines of code.
`;

// The subcommands check the command line before the command looks for the root, so that a wrong command line
// starts no server.
const subcommands = {
  file: {
    usage: 'file <path> [--json]', options: ['json'], operands: [1, 1],
    command: ([path], values) => ({ kind: 'file', path, json: values.json === true }),
  },
  complex: {
    usage: 'complex [--limit N] [--max-cyclomatic N]', options: ['limit', 'max-cyclomatic'], operands: [0, 0],
    command: (_operands, values) => toolCommand('find_complex_code', {
      limit: integerOf(values, 'limit', 1),
      max_cyclomatic: integerOf(values, 'max-cyclomatic', 0),
    }),
  },
  risky: {
    usage: 'risky [--limit N]', options: ['limit'], operands: [0, 0],
    command: (_operands, values) => toolCommand('find_risky_code', { limit: integerOf(values, 'limit', 1) }),
  },
  overview: { usage: 'overview', options: [], operands: [0, 0], command: () => toolCommand('analyze_project', {}) },
  tools: { usage: 'tools', options: [], operands: [0, 0], command: () => ({ kind: 'tools' }) },
  call: {
    usage: 'call <tool> [<json arguments>]', options: [], operands: [1, 2],
    command: ([name, json = '{}']) => toolCommand(name, argumentsOf(json)),
  },
};

function commandOf(args) {
  const { values, positionals } = parsedArguments(args);
  if (values.help) return { help: true };
  const [name, ...operands] = positionals;
  if (name === undefined) throw new CommandError('Give a subcommand. Use --help for the usage.');
  if (!Object.hasOwn(subcommands, name)) throw new CommandError(`Unknown subcommand: ${name}. Use --help for the usage.`);
  const subcommand = subcommands[name];
  const usage = `Usage: node script/ast-metrics-mcp.mjs ${subcommand.usage}`;
  const other = Object.keys(values).find((option) => !['help', 'timeout-ms', ...subcommand.options].includes(option));
  if (other !== undefined) throw new CommandError(`The --${other} option is not valid with ${name}. ${usage}`);
  const [fewest, most] = subcommand.operands;
  if (operands.length < fewest || operands.length > most) throw new CommandError(`Incorrect arguments for ${name}. ${usage}`);
  return { timeoutMs: timeoutOf(values['timeout-ms']), ...subcommand.command(operands, values) };
}

function parsedArguments(args) {
  try {
    return parseArgs({ args, allowPositionals: true, options: {
      json: { type: 'boolean' }, limit: { type: 'string' }, 'max-cyclomatic': { type: 'string' },
      'timeout-ms': { type: 'string', default: '60000' }, help: { type: 'boolean', short: 'h' },
    } });
  } catch {
    throw new CommandError('Invalid arguments. Use --help for the usage.');
  }
}

function timeoutOf(text) {
  const value = Number(text);
  if (!/^\d+$/.test(text) || value < 100 || value > 300_000) throw new CommandError('The --timeout-ms value must be an integer from 100 to 300000.');
  return value;
}

function integerOf(values, option, minimum) {
  const text = values[option];
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < minimum) {
    throw new CommandError(`The --${option} value must be an integer of ${minimum} or more.`);
  }
  return Number(text);
}

function argumentsOf(json) {
  const value = jsonOf(json);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new CommandError('The arguments of call must be a JSON object, for example {"limit":5}.');
  return value;
}

// An option that is not given is not sent, so that the server uses its default.
function toolCommand(name, args) {
  return { kind: 'tool', name, arguments: Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined)) };
}

function jsonOf(text) {
  try { return JSON.parse(text); } catch { return undefined; }
}

// The server names a file by its path from the root, with forward slashes. git gives the physical path of the root,
// so the folder of the path is resolved too: on macOS the temporary folders are symbolic links. A folder that does
// not exist stays as it is; the server then tells that it does not know the file.
function rootPathOf(root, path) {
  const absolute = resolve(path);
  let folder = dirname(absolute);
  try { folder = realpathSync(folder); } catch { /* The folder does not exist. */ }
  const fromRoot = relative(root, join(folder, basename(absolute)));
  if (fromRoot === '' || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) throw new CommandError(`The path must name a file in the repository root ${root}.`);
  return fromRoot.split(sep).join('/');
}

function workOf(command, root) {
  if (command.kind === 'tools') return toolList;
  if (command.kind === 'file') return fileWork(rootPathOf(root, command.path), command.json);
  return async (server) => formattedAnswer(await server.tool(command.name, command.arguments));
}

async function toolList(server) {
  return (await server.tools()).map((tool) => `${tool.name}: ${tool.description ?? ''}\n`).join('');
}

function fileWork(path, json) {
  return async (server) => {
    const text = await server.tool('get_file_metrics', { path });
    return json ? formattedAnswer(text) : fileSummary(path, text);
  };
}

function formattedAnswer(text) {
  const value = jsonOf(text);
  if (value === undefined) return text.endsWith('\n') ? text : `${text}\n`;
  return `${JSON.stringify(value, null, 2)}\n`;
}

function fileSummary(path, text) {
  const metrics = jsonOf(text);
  if (!Array.isArray(metrics?.functions) || typeof metrics.cyclomatic_complexity !== 'number') {
    throw new CommandError('get_file_metrics gave an unexpected answer. Use --json to see it.');
  }
  // Some answers have no file-level maintainability. Then the header gives no score.
  const score = metrics.maintainability?.maintainability_index;
  const header = [
    ...(typeof score === 'number' ? [`score ${score.toFixed(1)}`] : []),
    plural(metrics.cyclomatic_complexity, 'decision path'),
    plural(metrics.functions.length, 'function'),
  ];
  const functions = metrics.functions.toSorted((first, second) => scoreOf(first) - scoreOf(second));
  return [`${path}: ${header.join(', ')}`, '  score  paths  lines  name', ...functions.map(functionLine)].map((line) => `${line}\n`).join('');
}

function scoreOf(entry) {
  return entry.maintainability?.maintainability_index;
}

function functionLine(entry) {
  const score = scoreOf(entry);
  const cells = [typeof score === 'number' ? score.toFixed(1) : '-', entry.cyclomatic_complexity ?? '-', entry.volume?.loc ?? '-'];
  return `  ${cells.map((cell) => String(cell).padStart(5)).join('  ')}  ${entry.name || '(anonymous)'}`;
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

async function main() {
  const command = commandOf(process.argv.slice(2));
  if (command.help) return help;
  const root = repositoryRoot();
  return withAstMetricsServer(root, command.timeoutMs, workOf(command, root));
}

try {
  process.stdout.write(await main());
} catch (error) {
  const message = error instanceof CommandError ? error.message : `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
  // A diagnostic is one line, also when the server wrote several lines.
  process.stderr.write(`ast-metrics-mcp: ${message.replace(/\s+/g, ' ').trim()}\n`);
  process.exitCode = 1;
}
