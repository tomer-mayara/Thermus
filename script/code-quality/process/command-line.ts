import { parseArgs } from 'node:util';
import { CommandError } from '../shared/repository.ts';
import type { ProcessOptions } from './types.ts';

const shape = {
  base: { type: 'string', default: 'origin/main' }, coverage: { type: 'string' },
  'collect-coverage': { type: 'boolean' }, 'skip-coverage': { type: 'boolean' },
  out: { type: 'string' }, 'allow-tool-version': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
} as const;

export function processCommandOf(args: readonly string[]): ProcessOptions | { readonly help: true } {
  const values = parsedValues(args);
  if (values.help) return { help: true };
  if (!/^[^-]/u.test(values.base)) throw new CommandError('The --base value must name a git ref.');
  if (values.coverage === '') throw new CommandError('The --coverage value must name a file.');
  if (values.out === '') throw new CommandError('The --out value must name a file.');
  const collectCoverage = values['collect-coverage'] === true;
  const skipCoverage = values['skip-coverage'] === true;
  if (Number(collectCoverage) + Number(skipCoverage) + Number(values.coverage !== undefined) > 1) {
    throw new CommandError('Give only one of --coverage, --collect-coverage, or --skip-coverage.');
  }
  return { base: values.base, coverage: values.coverage, collectCoverage, skipCoverage, out: values.out, allowToolVersion: values['allow-tool-version'] === true };
}

function parsedValues(args: readonly string[]) {
  try { return parseArgs({ args, options: shape }).values; }
  catch { throw new CommandError('Invalid arguments. Use --help for the supported options.'); }
}
