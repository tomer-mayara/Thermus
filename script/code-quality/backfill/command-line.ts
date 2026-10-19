import { parseCommandArguments } from '../shared/command-line.ts';
import { CommandError } from '../shared/repository.ts';

export type BackfillCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'backfill'; readonly count: number; readonly allowToolVersion: boolean };

export function commandOf(args: readonly string[]): BackfillCommand {
  const { values } = parseCommandArguments({ args, options: {
    count: { type: 'string', default: '10' }, 'allow-tool-version': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) return { kind: 'help' };
  const count = Number(values.count);
  if (!/^\d+$/u.test(values.count) || !Number.isSafeInteger(count) || count < 1) throw new CommandError('The --count value must be a positive safe integer.');
  return { kind: 'backfill', count, allowToolVersion: values['allow-tool-version'] === true };
}
