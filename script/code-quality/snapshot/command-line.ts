import { checkBaseRef, parseCommandArguments, timeoutOf } from '../shared/command-line.ts';
import { CommandError } from '../shared/repository.ts';

// base is the --base value: without it the snapshot is of the working tree, with it of the merge base of that ref and
// HEAD. out is the --out value as the command line gives it, relative to the current folder; without it the snapshot
// goes to the default file in the repository root.
export type SnapshotCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'snapshot'; readonly allowToolVersion: boolean; readonly base: string | undefined; readonly out: string | undefined; readonly timeoutMs: number };

const optionShape = {
  'allow-tool-version': { type: 'boolean' }, base: { type: 'string' }, out: { type: 'string' }, 'timeout-ms': { type: 'string', default: '60000' }, help: { type: 'boolean', short: 'h' },
} as const;

// The command line is checked before the command looks for the root, so that a wrong command line runs nothing.
export function commandOf(args: readonly string[]): SnapshotCommand {
  const values = parsedValues(args);
  if (values.help) return { kind: 'help' };
  if (values.out === '') throw new CommandError('The --out value must name a file.');
  checkBaseRef(values.base);
  return { kind: 'snapshot', allowToolVersion: values['allow-tool-version'] === true, base: values.base, out: values.out, timeoutMs: timeoutOf(values['timeout-ms']) };
}

function parsedValues(args: readonly string[]) {
  return parseCommandArguments({ args, options: optionShape }).values;
}
