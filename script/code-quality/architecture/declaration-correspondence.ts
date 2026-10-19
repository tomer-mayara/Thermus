import { fileMappingOf } from './file-correspondence.ts';
import { declarationKey, uniqueBy, type Entries, type LocatedFunction, type Pairs } from './function-evidence.ts';
import type { MapSources } from './types.ts';

export function declarationPairs(sources: MapSources, entries: Entries): Pairs {
  const oldPaths = fileMappingOf(sources.changes).before;
  const keyOf = ({ file, fn }: LocatedFunction) => {
    const key = declarationKey(fn);
    return key === undefined ? undefined : JSON.stringify([file.path, key]);
  };
  const before = uniqueBy(entries.base, keyOf), after = uniqueBy(entries.head, keyOf);
  const pairs: Pairs = new Map();
  for (const entry of after.values()) {
    const path = oldPaths.get(entry.file.path) ?? entry.file.path;
    const partner = before.get(JSON.stringify([path, declarationKey(entry.fn)]));
    if (partner !== undefined) pairs.set(entry.fn, partner);
  }
  return pairs;
}
