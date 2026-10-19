import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoverageSuite } from '../provenance/types.ts';
import { CommandError } from '../shared/repository.ts';

export function selectedSuites(values: readonly string[] = ['unit']): readonly CoverageSuite[] {
  if (values.length === 0 || values.some((suite) => !['unit', 'integration', 'acceptance'].includes(suite))) throw new CommandError('--suite must be unit, integration, or acceptance.');
  return [...new Set(values)] as CoverageSuite[];
}

// Accept only the package's build prerequisite and direct Node test selections.
// A nested npm command could start a suite outside the caller's selection.
export function suiteCommands(root: string, suite: CoverageSuite): readonly string[][] {
  let command: unknown;
  try { command = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts?.[`test:${suite}`]; } catch { /* The diagnostic names the required contract below. */ }
  if (typeof command !== 'string') throw new CommandError(`The package has no test:${suite} script. Collection is deferred.`);
  const parts = command.split(/\s*&&\s*/);
  if (parts.shift() !== 'npm run build' || parts.length === 0) throw new CommandError(`Unsupported prerequisites in test:${suite}. Collection is deferred.`);
  return parts.map((part) => {
    const tokens = part.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g)?.map((token) => token.replace(/^(["'])(.*)\1$/, '$2')) ?? [];
    const [node, ...args] = tokens;
    if (node !== 'node' || args[0] !== '--test' || args.some((arg) => /[;&|`$<>\n]/.test(arg) || arg.split('/').includes('..') || (arg.startsWith('--') && arg !== '--test' && !/^--test-concurrency=\d+$/.test(arg)))) throw new CommandError(`Unsupported child command in test:${suite}. Collection is deferred.`);
    const selections = args.filter((arg) => !arg.startsWith('--'));
    if (selections.length === 0 || selections.some((arg) => !arg.startsWith(`dist/test/${suite}/`) && !arg.startsWith(`test/${suite}/`))) throw new CommandError(`test:${suite} would add an unselected suite. Collection is deferred.`);
    return args;
  });
}
