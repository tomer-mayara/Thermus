import { parseArgs } from 'node:util';
import type { McpCall } from './output.ts';
import { subcommands } from './subcommands.ts';
import { CommandError } from '../shared/repository.ts';

type Command = { readonly kind: 'help' } | (McpCall & { readonly timeoutMs: number });

export function commandOf(args: readonly string[]): Command {
  const { values, positionals } = parsedArguments(args);
  if (values.help) return { kind: 'help' };
  const [name, ...operands] = positionals;
  if (name === undefined) throw new CommandError('Give a subcommand. Use --help for the usage.');
  // Object.hasOwn refuses a name that comes from the prototype, such as toString.
  if (!Object.hasOwn(subcommands, name)) throw new CommandError(`Unknown subcommand: ${name}. Use --help for the usage.`);
  const subcommand = subcommands[name];
  const usage = `Usage: node script/code-quality/ast-metrics-mcp.ts ${subcommand.usage}`;
  const valid: readonly string[] = ['help', 'timeout-ms', ...subcommand.options];
  const other = Object.keys(values).find((option) => !valid.includes(option));
  if (other !== undefined) throw new CommandError(`The --${other} option is not valid with ${name}. ${usage}`);
  const [fewest, most] = subcommand.operands;
  if (operands.length < fewest || operands.length > most) throw new CommandError(`Incorrect arguments for ${name}. ${usage}`);
  return { timeoutMs: timeoutOf(values['timeout-ms']), ...subcommand.command(operands, values) };
}

function parsedArguments(args: readonly string[]) {
  try {
    return parseArgs({ args, allowPositionals: true, options: {
      json: { type: 'boolean' }, limit: { type: 'string' }, 'max-cyclomatic': { type: 'string' },
      'timeout-ms': { type: 'string', default: '60000' }, help: { type: 'boolean', short: 'h' },
    } });
  } catch {
    throw new CommandError('Invalid arguments. Use --help for the usage.');
  }
}

function timeoutOf(text: string): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || value < 100 || value > 300_000) throw new CommandError('The --timeout-ms value must be an integer from 100 to 300000.');
  return value;
}
