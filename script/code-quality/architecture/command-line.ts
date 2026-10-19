import { parseArgs } from 'node:util';
import { CommandError } from '../shared/repository.ts';
import { checkedOptionsOf } from './command-options.ts';

// With two snapshot files, the command runs neither git nor ast-metrics.
type SnapshotSource =
  | { readonly kind: 'files'; readonly head: string; readonly base: string }
  | { readonly kind: 'repository'; readonly ref: string; readonly timeoutMs: number; readonly allowToolVersion: boolean };

// touched is the --touched value as a list, which replaces the changed files of git. coverage, trendStore, and out are
// the values of --coverage, --trend-store, and --out as the command line gives them, relative to the current folder.
export type ArchitectureCommand =
  | { readonly kind: 'help' }
  | {
    readonly kind: 'report'; readonly source: SnapshotSource; readonly touched: readonly string[] | undefined; readonly changes?: string;
    readonly noCoverage: boolean; readonly record: boolean; readonly coverage: string | undefined; readonly trendStore: string | undefined; readonly out: string | undefined;
  };

const optionShape = {
  'allow-tool-version': { type: 'boolean' }, base: { type: 'string', default: 'origin/main' }, head: { type: 'string' }, 'base-snapshot': { type: 'string' }, touched: { type: 'string' }, changes: { type: 'string' },
  coverage: { type: 'string' }, 'no-coverage': { type: 'boolean' }, record: { type: 'boolean' }, 'trend-store': { type: 'string' }, 'timeout-ms': { type: 'string', default: '60000' }, out: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

type Values = ReturnType<typeof parsedValues>;

// The command line is checked before the command looks for the root, so that a wrong command line runs nothing.
export function commandOf(args: readonly string[]): ArchitectureCommand {
  const values = parsedValues(args);
  if (values.help) return { kind: 'help' };
  const { timeoutMs } = checkedOptionsOf(values);
  const touched = values.touched?.split(',').filter((path) => path !== '');
  const files = { noCoverage: values['no-coverage'] === true, record: values.record === true, coverage: values.coverage, trendStore: values['trend-store'], out: values.out };
  const source = sourceOf(values, timeoutMs);
  if (values.changes !== undefined && source.kind === 'repository') throw new CommandError('Give --changes only with --head and --base-snapshot; repository mode uses Git changes.');
  return { kind: 'report', source, touched, changes: values.changes, ...files };
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
  if (head === undefined && base === undefined) return { kind: 'repository', ref: values.base, timeoutMs, allowToolVersion: values['allow-tool-version'] === true };
  if (!head || !base) throw new CommandError('Give --head and --base-snapshot together, each with a snapshot file.');
  return { kind: 'files', head, base };
}
