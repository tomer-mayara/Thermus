import { createHash } from 'node:crypto';
import type { FileChange } from '../delta/changes.ts';

// Git diff does not include untracked destinations in its rename search. A
// unique exact body match gives those moves the same proof as a 100% rename.
export function reviewMoves(changes: readonly FileChange[], readBase: (path: string) => string, readHead: (path: string) => string): ReadonlyMap<string, string> {
  const moves = new Map(changes.flatMap((change) => change.status === 'R' && change.oldPath !== undefined ? [[change.oldPath, change.path] as const] : []));
  const deleted = bodiesOf(changes, 'D', readBase);
  const added = bodiesOf(changes, 'A', readHead);
  for (const [body, oldPaths] of deleted) {
    const newPaths = added.get(body) ?? [];
    if (oldPaths.length === 1 && newPaths.length === 1) moves.set(oldPaths[0], newPaths[0]);
  }
  return moves;
}

function bodiesOf(changes: readonly FileChange[], status: 'A' | 'D', read: (path: string) => string): ReadonlyMap<string, readonly string[]> {
  const bodies = new Map<string, string[]>();
  for (const change of changes) {
    if (change.status !== status || !change.path.startsWith('src/')) continue;
    const fingerprint = createHash('sha256').update(read(change.path)).digest('hex');
    const paths = bodies.get(fingerprint) ?? [];
    paths.push(change.path);
    bodies.set(fingerprint, paths);
  }
  return bodies;
}
