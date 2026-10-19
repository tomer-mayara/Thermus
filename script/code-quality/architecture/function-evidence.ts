import type { MapFunction, MapSnapshot, TableFile } from './types.ts';

export interface LocatedFunction {
  readonly file: TableFile;
  readonly fn: MapFunction;
}

export interface Entries { readonly base: readonly LocatedFunction[]; readonly head: readonly LocatedFunction[] }
export type Pairs = Map<MapFunction, LocatedFunction>;

export function functionsIn(snapshot: MapSnapshot): LocatedFunction[] {
  return snapshot.files.flatMap((file) => (file.functions ?? []).map((fn) => ({ file, fn })));
}

export function declarationKey({ identity }: MapFunction): string | undefined {
  if (identity === undefined || identity.name === '' || identity.name === '(anonymous)') return undefined;
  return JSON.stringify([identity.version, identity.kind, identity.owner, identity.name]);
}

export function bodyKey(fn: MapFunction): string | undefined {
  const { identity } = fn;
  if (declarationKey(fn) === undefined) return undefined;
  return JSON.stringify([identity?.version, identity?.body, identity?.signature]);
}

export function uniqueBy(entries: readonly LocatedFunction[], keyOf: (entry: LocatedFunction) => string | undefined): ReadonlyMap<string, LocatedFunction> {
  const groups = new Map<string, LocatedFunction[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (key === undefined) continue;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return new Map([...groups].flatMap(([key, group]) => group.length === 1 ? [[key, group[0]]] : []));
}

export function completeSource(file: TableFile): boolean {
  return file.sourceEvidence?.complete === true && file.functions !== undefined;
}

export function uniqueDeclaration(entry: LocatedFunction, entries: readonly LocatedFunction[]): boolean {
  const key = declarationKey(entry.fn);
  return key !== undefined && entries.filter(({ file, fn }) => file.path === entry.file.path && declarationKey(fn) === key).length === 1;
}
