import { isOver, type FileCrap, type FunctionCrap } from './crap.ts';
import type { MapCommunity } from './types.ts';

export function countOf(functions: readonly FunctionCrap[]): number {
  return functions.filter(isOver).length;
}

export function memberFunctionsOf<T extends FunctionCrap>(files: ReadonlyMap<string, { readonly functions: readonly T[] }>, { members }: Pick<MapCommunity, 'members'>): T[] {
  return members.flatMap((path) => files.get(path)?.functions ?? []);
}

export function totalCountOf(files: ReadonlyMap<string, FileCrap>): number {
  return countOf([...files.values()].flatMap((file) => file.functions));
}
