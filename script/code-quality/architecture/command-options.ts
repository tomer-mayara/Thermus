import { CommandError } from '../shared/repository.ts';

interface CommandValues {
  readonly base: string;
  readonly out?: string;
  readonly coverage?: string;
  readonly changes?: string;
  readonly 'no-coverage'?: boolean;
  readonly 'trend-store'?: string;
  readonly 'timeout-ms': string;
}

export function checkedOptionsOf(values: CommandValues): { readonly timeoutMs: number } {
  validatePaths(values);
  // Git would take a ref that starts with a dash as an option.
  if (!/^[^-]/u.test(values.base)) throw new CommandError('The --base value must name a git ref.');
  return { timeoutMs: timeoutOf(values['timeout-ms']) };
}

function validatePaths(values: CommandValues): void {
  if (values.out === '') throw new CommandError('The --out value must name a file.');
  if (values['no-coverage'] && values.coverage !== undefined) throw new CommandError('Give --coverage or --no-coverage, not both.');
  if (values.coverage === '') throw new CommandError('The --coverage value must name a file.');
  if (values.changes === '') throw new CommandError('The --changes value must name a file.');
  if (values['trend-store'] === '') throw new CommandError('The --trend-store value must name a folder.');
}

function timeoutOf(text: string): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || value < 100 || value > 300_000) throw new CommandError('The --timeout-ms value must be an integer from 100 to 300000.');
  return value;
}
