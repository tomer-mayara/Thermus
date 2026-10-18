// The change of the CRAP of each function of the head against the base, which the bands of
// docs/implementation/architecture-evolution-plan.md ("Bands") follow: they judge the change, not the total.
import { crapLimit, isOver, type FileCrap, type FunctionCrap } from './ast-metrics-architecture-crap.ts';
import { snapshotCrapOf } from './ast-metrics-architecture-shares.ts';
import type { MapSources, TableFile } from './ast-metrics-architecture-types.ts';

// base: the CRAP of the function in the base, new when the base file does not have its name, or absent when the base
// gives the name no CRAP, such as a name that the base file has twice: then the change is not known.
export interface JudgedFunction extends FunctionCrap {
  readonly base: number | 'new' | undefined;
  readonly addedOrWorse: boolean;
}

interface JudgedFile {
  readonly functions: readonly JudgedFunction[];
  readonly unmatched: number;
}

// Each file of the head with its judged functions, and each file of the base, by path.
export interface CrapDelta {
  readonly head: ReadonlyMap<string, JudgedFile>;
  readonly base: ReadonlyMap<string, FileCrap>;
}

// Without coverage, the report has no bands.
export function crapDeltaOf(sources: MapSources): CrapDelta | undefined {
  const crap = snapshotCrapOf(sources);
  if (crap === undefined) return undefined;
  const baseFiles = new Map(sources.base.files.map((file) => [file.path, file]));
  const head = [...crap.head].map(([path, file]): [string, JudgedFile] => [path, judgedFileOf(file, baseFiles.get(path), crap.base.get(path))]);
  return { head: new Map(head), base: crap.base };
}

function judgedFileOf({ functions, unmatched }: FileCrap, baseFile: TableFile | undefined, baseCrap: FileCrap | undefined): JudgedFile {
  return { functions: functions.map((entry) => judged(entry, baseValueOf(entry.name, baseFile, baseCrap))), unmatched };
}

function baseValueOf(name: string, file: TableFile | undefined, crap: FileCrap | undefined): JudgedFunction['base'] {
  if (!file?.functions?.some((entry) => entry.name === name)) return 'new';
  return crap?.functions.find((entry) => entry.name === name)?.crap;
}

// A function is worse when it is at the limit or above in the head and below it in the base, or at the limit or above
// on both sides with a higher CRAP in the head.
function judged(entry: FunctionCrap, base: JudgedFunction['base']): JudgedFunction {
  const worse = typeof base === 'number' && (base < crapLimit || entry.crap > base);
  return { ...entry, base, addedOrWorse: isOver(entry) && (base === 'new' || worse) };
}
