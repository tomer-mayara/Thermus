#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { Client, ProtocolError } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

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

const guide = 'docs/implementation/ast-metrics-review.md';
const diagnosticStderrLimit = 2_000;

class CommandError extends Error {}

// The subcommands check the command line before the command looks for the root, so that a wrong command line
// starts no server.
const subcommands = {
  file: {
    usage: 'file <path> [--json]',
    options: ['json'],
    operands: [1, 1],
    command: ([path], values) => ({ kind: 'file', path, json: values.json === true }),
  },
  complex: {
    usage: 'complex [--limit N] [--max-cyclomatic N]',
    options: ['limit', 'max-cyclomatic'],
    operands: [0, 0],
    command: (_operands, values) => toolCommand('find_complex_code', {
      limit: integerOf(values, 'limit', 1),
      max_cyclomatic: integerOf(values, 'max-cyclomatic', 0),
    }),
  },
  risky: {
    usage: 'risky [--limit N]',
    options: ['limit'],
    operands: [0, 0],
    command: (_operands, values) => toolCommand('find_risky_code', { limit: integerOf(values, 'limit', 1) }),
  },
  overview: { usage: 'overview', options: [], operands: [0, 0], command: () => toolCommand('analyze_project', {}) },
  tools: { usage: 'tools', options: [], operands: [0, 0], command: () => ({ kind: 'tools' }) },
  call: {
    usage: 'call <tool> [<json arguments>]',
    options: [],
    operands: [1, 2],
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
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function repositoryRootOf(timeoutMs) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: timeoutMs }).replace(/\n$/, '');
  } catch {
    throw new CommandError('Run the command in a git working tree: git rev-parse --show-toplevel failed.');
  }
}

// The server names a file by its path from the root, with forward slashes. git gives the physical path of the root,
// so the folder of the path is resolved too: on macOS the temporary folders are symbolic links.
function rootPathOf(root, path) {
  const absolute = resolve(path);
  let folder = dirname(absolute);
  try {
    folder = realpathSync(folder);
  } catch {
    // A folder that does not exist stays as it is. The server then tells that it does not know the file.
  }
  const fromRoot = relative(root, join(folder, basename(absolute)));
  if (fromRoot === '' || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) throw new CommandError(`The path must name a file in the repository root ${root}.`);
  return fromRoot.split(sep).join('/');
}

function workOf(command, root) {
  if (command.kind === 'tools') return listTools;
  if (command.kind === 'file') return fileWork(rootPathOf(root, command.path), command.json);
  return async (client, callOptions) => formattedAnswer(await answerText(client, { name: command.name, arguments: command.arguments }, callOptions));
}

async function listTools(client, callOptions) {
  const { tools } = await client.listTools(undefined, callOptions);
  return tools.map((tool) => `${tool.name}: ${tool.description ?? ''}\n`).join('');
}

function fileWork(path, json) {
  return async (client, callOptions) => {
    const text = await answerText(client, { name: 'get_file_metrics', arguments: { path } }, callOptions);
    return json ? formattedAnswer(text) : fileSummary(path, text);
  };
}

async function answerText(client, call, callOptions) {
  const result = await client.callTool(call, callOptions);
  const texts = result.content.filter((item) => item.type === 'text').map((item) => item.text);
  if (result.isError) throw new CommandError(`${call.name} failed: ${texts.join(' ')}`);
  if (result.content.length !== 1 || texts.length !== 1) throw new CommandError(`${call.name} gave an unexpected answer: expected one text item.`);
  return texts[0];
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

// The server runs in the root, because it analyzes the folder that it runs in.
class ServerProcess {
  #transport;
  #client = new Client({ name: 'thermus-ast-metrics-mcp', version: '0.0.0' });
  #stderr = '';
  #spawnError;
  #exit;

  constructor(root) {
    this.#transport = new StdioClientTransport({ command: 'ast-metrics', args: ['mcp'], cwd: root, env: process.env, stderr: 'pipe' });
    // Read all of stderr, so that a full pipe cannot stop the server. Keep the start of it for a diagnostic.
    this.#transport.stderr.setEncoding('utf8').on('data', (chunk) => { this.#stderr = (this.#stderr + chunk).slice(0, diagnosticStderrLimit); });
    // A failed start, such as ENOENT, also closes the transport. Keep its error, so that the diagnostic names it.
    this.#transport.onerror = (error) => { if (String(error?.syscall).startsWith('spawn')) this.#spawnError = error; };
    this.#exit = new Promise((_resolve, reject) => {
      this.#transport.onclose = () => reject(this.#spawnError ?? new CommandError(`ast-metrics exited before it answered. ${this.#stderrNote()}`));
    });
    // The exit after the answer is no failure.
    this.#exit.catch(() => undefined);
  }

  // The SDK waits without end for a write to a server that has exited, and its request timeout does not cover the
  // notifications/initialized message. So the exit of the server also ends the call.
  run(work, callOptions) {
    return Promise.race([this.#call(work, callOptions), this.#exit]);
  }

  async #call(work, callOptions) {
    await this.#client.connect(this.#transport, callOptions);
    return work(this.#client, callOptions);
  }

  failureOf(error) {
    if (error instanceof CommandError) return error;
    if (error?.code === 'ENOENT') return new CommandError(`ast-metrics is not installed, or it is not on PATH. See ${guide}.`);
    if (error instanceof ProtocolError) return new CommandError(`ast-metrics refused the request: ${error.message}`);
    return new CommandError(`The MCP call failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  #stderrNote() {
    const text = this.#stderr.trim();
    return text === '' ? 'It wrote nothing to stderr.' : `Its stderr: ${text}`;
  }

  // Closing the client closes the input of the server, and the server exits by itself. After a timeout the server
  // is still at work, so it gets SIGTERM first. The transport sends SIGTERM and then SIGKILL to a server that stays.
  async stop(now) {
    const pid = this.#transport.pid;
    if (now && pid !== null) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // The server exited in the meantime.
      }
    }
    await this.#client.close();
  }
}

async function callServer(root, timeoutMs, work) {
  const server = new ServerProcess(root);
  const timeout = new CommandError(`The call timed out after ${timeoutMs} ms. Increase --timeout-ms if needed.`);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(timeout), timeoutMs);
  const timedOut = new Promise((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(timeout), { once: true });
  });
  try {
    return await Promise.race([server.run(work, { signal: controller.signal, timeout: timeoutMs }), timedOut]);
  } catch (error) {
    throw controller.signal.aborted ? timeout : server.failureOf(error);
  } finally {
    clearTimeout(deadline);
    await server.stop(controller.signal.aborted);
  }
}

async function main() {
  const command = commandOf(process.argv.slice(2));
  if (command.help) {
    process.stdout.write(help);
    return;
  }
  const root = repositoryRootOf(command.timeoutMs);
  process.stdout.write(await callServer(root, command.timeoutMs, workOf(command, root)));
}

try {
  await main();
} catch (error) {
  const message = error instanceof CommandError ? error.message : `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
  // A diagnostic is one line, also when the server wrote several lines.
  process.stderr.write(`ast-metrics-mcp: ${message.replace(/\s+/g, ' ').trim()}\n`);
  process.exitCode = 1;
}
