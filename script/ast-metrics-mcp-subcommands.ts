import { isJsonObject, jsonOf, type JsonObject } from './ast-metrics-json.ts';
import type { McpCall } from './ast-metrics-mcp-output.ts';
import { CommandError } from './repository.ts';

// A subcommand reads only the options that it lists: the command line refuses each other option.
interface SubcommandValues {
  readonly json?: boolean;
  readonly limit?: string;
  readonly 'max-cyclomatic'?: string;
}

interface Subcommand {
  readonly usage: string;
  readonly options: readonly (keyof SubcommandValues)[];
  readonly operands: readonly [fewest: number, most: number];
  command(operands: readonly string[], values: SubcommandValues): McpCall;
}

// The subcommands check the command line before the command looks for the root, so that a wrong command line
// starts no server.
export const subcommands: Readonly<Record<string, Subcommand>> = {
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

function integerOf(values: SubcommandValues, option: 'limit' | 'max-cyclomatic', minimum: number): number | undefined {
  const text = values[option];
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < minimum) {
    throw new CommandError(`The --${option} value must be an integer of ${minimum} or more.`);
  }
  return Number(text);
}

function argumentsOf(json: string): JsonObject {
  const value = jsonOf(json);
  if (!isJsonObject(value)) throw new CommandError('The arguments of call must be a JSON object, for example {"limit":5}.');
  return value;
}

// An option that is not given is not sent, so that the server uses its default.
function toolCommand(name: string, args: JsonObject): McpCall {
  return { kind: 'tool', name, arguments: Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined)) };
}
