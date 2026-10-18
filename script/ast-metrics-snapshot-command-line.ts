import { parseArgs } from 'node:util';
import { CommandError } from './repository.ts';

// base is the --base value: without it the snapshot is of the working tree, with it of the merge base of that ref and
// HEAD. out is the --out value as the command line gives it, relative to the current folder; without it the snapshot
// goes to the default file in the repository root.
export type SnapshotCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'snapshot'; readonly base: string | undefined; readonly out: string | undefined; readonly timeoutMs: number };

const optionShape = {
  base: { type: 'string' }, out: { type: 'string' }, 'timeout-ms': { type: 'string', default: '60000' }, help: { type: 'boolean', short: 'h' },
} as const;

// The command line is checked before the command looks for the root, so that a wrong command line runs nothing.
export function commandOf(args: readonly string[]): SnapshotCommand {
  const values = parsedValues(args);
  if (values.help) return { kind: 'help' };
  if (values.out === '') throw new CommandError('The --out value must name a file.');
  // git would take a ref that starts with a dash as an option.
  if (values.base === '' || values.base?.startsWith('-')) throw new CommandError('The --base value must name a git ref.');
  return { kind: 'snapshot', base: values.base, out: values.out, timeoutMs: timeoutOf(values['timeout-ms']) };
}

function parsedValues(args: readonly string[]) {
  try {
    return parseArgs({ args, options: optionShape }).values;
  } catch {
    throw new CommandError('Invalid arguments. Use --help for the supported options.');
  }
}

function timeoutOf(text: string): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || value < 100 || value > 300_000) throw new CommandError('The --timeout-ms value must be an integer from 100 to 300000.');
  return value;
}
