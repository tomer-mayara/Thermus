import { readFileSync } from 'node:fs';
import { sourcePathOf } from './source-path.ts';
import { CommandError } from '../shared/repository.ts';

export function sourceTextsOf(root: string, paths: readonly string[]): ReadonlyMap<string, string> {
  return new Map(paths.map((path) => [path, sourceText(root, path)]));
}

function sourceText(root: string, path: string): string {
  try {
    return readFileSync(sourcePathOf(root, path), 'utf8');
  } catch {
    throw new CommandError(`Cannot read source evidence for ${path}. No snapshot was published.`);
  }
}
