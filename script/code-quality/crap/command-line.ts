import { parseCommandArguments } from '../shared/command-line.ts';
import { CommandError } from '../shared/repository.ts';
import type { CrapGoals } from './types.ts';

export type CrapCommand = { readonly kind: 'help' } | ({ readonly kind: 'report'; readonly base: string; readonly coverage?: string; readonly paths: readonly string[]; readonly allowToolVersion: boolean } & CrapGoals);

const options = {
  base: { type: 'string', default: 'origin/main' }, coverage: { type: 'string' },
  limit: { type: 'string', default: '30' }, target: { type: 'string', default: '15' },
  'allow-tool-version': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
} as const;

export function commandOf(args: readonly string[]): CrapCommand {
  const { values, positionals } = parsed(args);
  if (values.help) return { kind: 'help' };
  const limit = thresholdOf('limit', values.limit), target = thresholdOf('target', values.target);
  if (target >= limit) throw new CommandError('The target must be less than the limit.');
  if (values.base.trim() === '' || values.base.startsWith('-')) throw new CommandError('The --base value must name a ref.');
  return { kind: 'report', base: values.base, coverage: values.coverage, limit, target, paths: positionals, allowToolVersion: values['allow-tool-version'] === true };
}

function parsed(args: readonly string[]) {
  return parseCommandArguments({ args, options, allowPositionals: true });
}

function thresholdOf(option: string, text: string): number {
  const value = Number(text);
  const digits = text.replace('.', '');
  if (!/^\d+(?:\.\d{1,6})?$/u.test(text) || !Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Number(digits))) {
    throw new CommandError(`The --${option} value must be a finite positive decimal with at most six fractional digits and safe integer decimal digits.`);
  }
  return value;
}
