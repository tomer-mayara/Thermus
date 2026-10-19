import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { CommandError } from '../shared/repository.ts';

type Entry = readonly [string, Buffer];
function framed(hash: ReturnType<typeof createHash>, bytes: Buffer): void {
  hash.update(`${bytes.length}:`);
  hash.update(bytes);
}
export function fingerprintOf(entries: readonly Entry[]): string {
  const hash = createHash('sha256');
  for (const [path, content] of [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    framed(hash, Buffer.from(path));
    framed(hash, content);
  }
  return hash.digest('hex');
}
export function treeEntries(root: string, accept: (path: string) => boolean): Entry[] {
  try {
    return visit({ actual: root, path: '', parents: new Set<string>(), accept });
  } catch (error) {
    if (error instanceof CommandError) throw error;
    throw new CommandError(`Cannot fingerprint inputs: ${error instanceof Error ? error.message : String(error)}`);
  }
}
type Visit = { actual: string; path: string; parents: Set<string>; accept: (path: string) => boolean };
function visit(state: Visit): Entry[] {
  const stat = lstatSync(state.actual);
  if (stat.isSymbolicLink()) return linkedEntries(state);
  if (stat.isFile()) return [[state.path, readFileSync(state.actual)], [`\0mode:${state.path}`, Buffer.from(String(stat.mode & 0o111))]];
  if (!stat.isDirectory()) throw new CommandError(`Unsupported input file ${state.path}.`);
  const actual = realpathSync(state.actual);
  if (state.parents.has(actual)) throw new CommandError(`Input symlink cycle at ${state.path}.`);
  const parents = new Set([...state.parents, actual]);
  return readdirSync(state.actual).flatMap((name) => {
    const path = state.path === '' ? name : `${state.path}/${name}`;
    return state.accept(path) ? visit({ ...state, actual: join(state.actual, name), path, parents }) : [];
  });
}
function linkedEntries(state: Visit): Entry[] {
  const link = readlinkSync(state.actual);
  const actual = realpathSync(state.actual);
  if (state.parents.has(actual)) throw new CommandError(`Input symlink cycle at ${state.path}.`);
  return [[`\0symlink:${state.path}`, Buffer.from(link)], ...visit({ ...state, actual })];
}
