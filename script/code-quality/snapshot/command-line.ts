import { checkBaseRef, parseCommandArguments, timeoutOf } from '../shared/command-line.ts';
import { CommandError } from '../shared/repository.ts';

// base selects the merge base of that ref and HEAD. commit selects one exact revision. Without either, the snapshot
// is of the working tree. out is relative to the current folder; its default is in the repository root.
export type SnapshotCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'snapshot'; readonly allowToolVersion: boolean; readonly base: string | undefined; readonly commit: string | undefined; readonly out: string | undefined; readonly timeoutMs: number };

const optionShape = {
  'allow-tool-version': { type: 'boolean' }, base: { type: 'string' }, commit: { type: 'string' }, out: { type: 'string' }, 'timeout-ms': { type: 'string', default: '60000' }, help: { type: 'boolean', short: 'h' },
} as const;

// The command line is checked before the command looks for the root, so that a wrong command line runs nothing.
export function commandOf(args: readonly string[]): SnapshotCommand {
  const values = parsedValues(args);
  if (values.help) return { kind: 'help' };
  if (values.out === '') throw new CommandError('The --out value must name a file.');
  checkBaseRef(values.base);
  if (values.base !== undefined && values.commit !== undefined) throw new CommandError('Use only one of --base and --commit.');
  if (values.commit !== undefined && !/^[a-f0-9]{40}$/u.test(values.commit)) throw new CommandError('The --commit value must be a full lowercase 40-character commit SHA.');
  return { kind: 'snapshot', allowToolVersion: values['allow-tool-version'] === true, base: values.base, commit: values.commit, out: values.out, timeoutMs: timeoutOf(values['timeout-ms']) };
}

function parsedValues(args: readonly string[]) {
  return parseCommandArguments({ args, options: optionShape }).values;
}
