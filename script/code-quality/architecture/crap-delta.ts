// The change of the CRAP of each function of the head against the base, which the bands of
// docs/implementation/architecture-evolution-plan.md ("Bands") follow: they judge the change, not the total.
import { crapLimit, isOver, snapshotCrapOf, type FileCrap, type FunctionCrap } from './crap.ts';
import type { FunctionCorrespondence } from './correspondence.ts';
import type { MapSources } from './types.ts';

// Base risk requires a proven predecessor and a head covered share. New requires proven absence; unknown identity
// or coverage leaves the base value absent.
export interface JudgedFunction extends FunctionCrap {
  readonly base: number | 'new' | undefined;
  readonly addedOrWorse: boolean;
  readonly classification: FunctionCorrespondence['classification'];
}

interface JudgedFile {
  readonly functions: readonly JudgedFunction[];
  readonly unmatched: number;
}

// Each file of the head with its judged functions, and each file of the base, by path.
export interface CrapDelta {
  readonly head: ReadonlyMap<string, JudgedFile>;
  readonly base: ReadonlyMap<string, FileCrap>;
  readonly unknownIdentity: number;
}

// Without coverage, the report has no bands.
export function crapDeltaOf(sources: MapSources): CrapDelta | undefined {
  const crap = snapshotCrapOf(sources);
  if (crap === undefined) return undefined;
  const sourceFiles = new Map(sources.head.files.map((file) => [file.path, file]));
  const head = [...crap.head].map(([path, file]): [string, JudgedFile] => {
    const functions = file.functions.map((entry) => {
      const fn = sourceFiles.get(path)?.functions?.find((fn) => fn.name === entry.name);
      const identity = fn && crap.correspondence.head.get(fn);
      return judged(entry, identity, crap.base);
    });
    return [path, { functions, unmatched: file.unmatched }];
  });
  const unknownIdentity = [...crap.correspondence.head.values()].filter(({ classification }) => classification === 'unknown').length;
  return { head: new Map(head), base: crap.base, unknownIdentity };
}

function baseValueOf(identity: FunctionCorrespondence | undefined, files: ReadonlyMap<string, FileCrap>): JudgedFunction['base'] {
  if (identity?.classification === 'new') return 'new';
  const partner = identity?.base;
  return partner && files.get(partner.file.path)?.functions.find((entry) => entry.name === partner.fn.name)?.crap;
}

// A function is worse when it is at the limit or above in the head and below it in the base, or at the limit or above
// on both sides with a higher CRAP in the head.
function judged(entry: FunctionCrap, identity: FunctionCorrespondence | undefined, files: ReadonlyMap<string, FileCrap>): JudgedFunction {
  const base = baseValueOf(identity, files);
  const worse = typeof base === 'number' && (base < crapLimit || entry.crap > base);
  return { ...entry, base, classification: identity?.classification ?? 'unknown', addedOrWorse: isOver(entry) && (base === 'new' || worse) };
}
