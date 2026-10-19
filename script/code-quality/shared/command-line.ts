import { parseArgs, type ParseArgsConfig } from 'node:util';
import { CommandError } from './command-error.ts';

export function parseCommandArguments<const T extends ParseArgsConfig>(configuration: T, diagnostic = 'Invalid arguments. Use --help for the supported options.') {
  try {
    return parseArgs(configuration);
  } catch {
    throw new CommandError(diagnostic);
  }
}

export function checkBaseRef(base: string | undefined): void {
  // Git takes a ref that starts with a dash as an option.
  if (base === '' || base?.startsWith('-')) throw new CommandError('The --base value must name a git ref.');
}

export function timeoutOf(text: string): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || value < 100 || value > 300_000) throw new CommandError('The --timeout-ms value must be an integer from 100 to 300000.');
  return value;
}
