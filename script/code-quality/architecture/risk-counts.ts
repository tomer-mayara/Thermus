import { isOver, type FileCrap, type FunctionCrap } from './crap.ts';
import type { MapCommunity } from './types.ts';

// The count of the functions at CRAP 30 or more.
export function countOf(functions: readonly FunctionCrap[]): number {
  return functions.filter(isOver).length;
}

// The functions of the files of a community, from the files of one snapshot by path.
export function memberFunctionsOf<T extends FunctionCrap>(files: ReadonlyMap<string, { readonly functions: readonly T[] }>, { members }: Pick<MapCommunity, 'members'>): T[] {
  return members.flatMap((path) => files.get(path)?.functions ?? []);
}

// The count of the functions at CRAP 30 or more in all the files of one snapshot, as the summary line and the trend give
// it.
export function totalCountOf(files: ReadonlyMap<string, FileCrap>): number {
  return countOf([...files.values()].flatMap((file) => file.functions));
}
