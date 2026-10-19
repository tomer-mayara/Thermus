import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CommandError } from '../shared/repository.ts';

export function sourceTextsOf(root: string, paths: readonly string[]): ReadonlyMap<string, string> {
  return new Map(paths.map((path) => [path, sourceText(root, path)]));
}

function sourceText(root: string, path: string): string {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    throw new CommandError(`Cannot read source evidence for ${path}. No snapshot was published.`);
  }
}
