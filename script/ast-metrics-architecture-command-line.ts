import { parseArgs } from 'node:util';
import { CommandError } from './repository.ts';

// With two snapshot files, the command runs neither git nor ast-metrics.
type SnapshotSource =
  | { readonly kind: 'files'; readonly head: string; readonly base: string }
  | { readonly kind: 'repository'; readonly ref: string; readonly timeoutMs: number };

// touched is the --touched value as a list, which replaces the changed files of git. coverage, trendStore, and out are
// the values of --coverage, --trend-store, and --out as the command line gives them, relative to the current folder.
export type ArchitectureCommand =
  | { readonly kind: 'help' }
  | {
    readonly kind: 'report'; readonly source: SnapshotSource; readonly touched: readonly string[] | undefined;
    readonly coverage: string | undefined; readonly trendStore: string | undefined; readonly out: string | undefined;
  };

const optionShape = {
  base: { type: 'string', default: 'origin/main' }, head: { type: 'string' }, 'base-snapshot': { type: 'string' }, touched: { type: 'string' },
  coverage: { type: 'string' }, 'trend-store': { type: 'string' }, 'timeout-ms': { type: 'string', default: '60000' }, out: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

type Values = ReturnType<typeof parsedValues>;

// The command line is checked before the command looks for the root, so that a wrong command line runs nothing.
export function commandOf(args: readonly string[]): ArchitectureCommand {
  const values = parsedValues(args);
  if (values.help) return { kind: 'help' };
  if (values.out === '') throw new CommandError('The --out value must name a file.');
  if (values.coverage === '') throw new CommandError('The --coverage value must name a file.');
  if (values['trend-store'] === '') throw new CommandError('The --trend-store value must name a folder.');
  // git would take a ref that starts with a dash as an option.
  if (values.base === '' || values.base.startsWith('-')) throw new CommandError('The --base value must name a git ref.');
  const touched = values.touched?.split(',').filter((path) => path !== '');
  const files = { coverage: values.coverage, trendStore: values['trend-store'], out: values.out };
  return { kind: 'report', source: sourceOf(values, timeoutOf(values['timeout-ms'])), touched, ...files };
}

function parsedValues(args: readonly string[]) {
  try {
    return parseArgs({ args, options: optionShape }).values;
  } catch {
    throw new CommandError('Invalid arguments. Use --help for the supported options.');
  }
}

function sourceOf(values: Values, timeoutMs: number): SnapshotSource {
  const { head, 'base-snapshot': base } = values;
  if (head === undefined && base === undefined) return { kind: 'repository', ref: values.base, timeoutMs };
  if (!head || !base) throw new CommandError('Give --head and --base-snapshot together, each with a snapshot file.');
  return { kind: 'files', head, base };
}

function timeoutOf(text: string): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || value < 100 || value > 300_000) throw new CommandError('The --timeout-ms value must be an integer from 100 to 300000.');
  return value;
}
