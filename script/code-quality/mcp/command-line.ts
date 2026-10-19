import { parseCommandArguments, timeoutOf } from '../shared/command-line.ts';
import type { McpCall } from './output.ts';
import { subcommands } from './subcommands.ts';
import { CommandError } from '../shared/repository.ts';

export const help = `Usage: node script/code-quality/ast-metrics-mcp.ts <subcommand> [options]

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
  --limit N           complex, risky: the maximum number of results (default: delegated to ast-metrics)
  --max-cyclomatic N  complex: show the items above this complexity (default: delegated to ast-metrics)
  --timeout-ms MS     Deadline of the MCP call (100..300000; default: 60000)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h          Show this help

The score is the maintainability index (0 to 128; more is better). The paths are the
decision paths (cyclomatic complexity). The lines column is a count of lines of
code (LOC), not a source position.
`;

type Command = { readonly kind: 'help' } | (McpCall & { readonly timeoutMs: number; readonly allowToolVersion: boolean });

export function commandOf(args: readonly string[]): Command {
  const { values, positionals } = parsedArguments(args);
  if (values.help) return { kind: 'help' };
  const [name, ...operands] = positionals;
  if (name === undefined) throw new CommandError('Give a subcommand. Use --help for the usage.');
  // Object.hasOwn refuses a name that comes from the prototype, such as toString.
  if (!Object.hasOwn(subcommands, name)) throw new CommandError(`Unknown subcommand: ${name}. Use --help for the usage.`);
  const subcommand = subcommands[name];
  const usage = `Usage: node script/code-quality/ast-metrics-mcp.ts ${subcommand.usage}`;
  const valid: readonly string[] = ['help', 'timeout-ms', 'allow-tool-version', ...subcommand.options];
  const other = Object.keys(values).find((option) => !valid.includes(option));
  if (other !== undefined) throw new CommandError(`The --${other} option is not valid with ${name}. ${usage}`);
  const [fewest, most] = subcommand.operands;
  if (operands.length < fewest || operands.length > most) throw new CommandError(`Incorrect arguments for ${name}. ${usage}`);
  return { allowToolVersion: values['allow-tool-version'] === true, timeoutMs: timeoutOf(values['timeout-ms']), ...subcommand.command(operands, values) };
}

function parsedArguments(args: readonly string[]) {
  return parseCommandArguments({ args, allowPositionals: true, options: {
    'allow-tool-version': { type: 'boolean' }, json: { type: 'boolean' }, limit: { type: 'string' }, 'max-cyclomatic': { type: 'string' },
    'timeout-ms': { type: 'string', default: '60000' }, help: { type: 'boolean', short: 'h' },
  } }, 'Invalid arguments. Use --help for the usage.');
}
