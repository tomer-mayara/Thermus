import { crapLimit, isOver, type FileCrap, type FunctionCrap } from './crap.ts';
import { compareCrap } from './crap-score.ts';
import type { FunctionCorrespondence } from './correspondence.ts';
import { snapshotCrapOf } from './crap-snapshots.ts';
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
  readonly incomplete?: true;
}

export interface CrapDelta {
  readonly head: ReadonlyMap<string, JudgedFile>;
  readonly base: ReadonlyMap<string, FileCrap>;
  readonly unknownIdentity: number;
}

export function crapDeltaOf(sources: MapSources): CrapDelta | undefined {
  const crap = snapshotCrapOf(sources);
  if (crap === undefined) return undefined;
  const sourceFiles = new Map(sources.head.files.map((file) => [file.path, file]));
  const head = [...crap.head].map(([path, file]): [string, JudgedFile] => {
    const functions = file.functions.map((entry, index) => {
      const fn = sourceFiles.get(path)?.functions?.[index];
      const identity = fn && crap.correspondence.head.get(fn);
      return judged(entry, identity, crap.base);
    });
    return [path, { ...file, functions }];
  });
  const unknownIdentity = [...crap.correspondence.head.values()].filter(({ classification }) => classification === 'unknown').length;
  return { head: new Map(head), base: crap.base, unknownIdentity };
}

function baseValueOf(identity: FunctionCorrespondence | undefined, files: ReadonlyMap<string, FileCrap>): JudgedFunction['base'] {
  if (identity === undefined) return undefined;
  if (identity.classification === 'new') return 'new';
  const entry = baseEntryOf(identity.base, files);
  return entry?.share === undefined ? undefined : entry.crap;
}

function baseEntryOf(partner: FunctionCorrespondence['base'], files: ReadonlyMap<string, FileCrap>): FunctionCrap | undefined {
  if (partner === undefined) return undefined;
  const functions = partner.file.functions ?? [];
  return files.get(partner.file.path)?.functions[functions.indexOf(partner.fn)];
}

// A function is worse when it is at the limit or above in the head and below it in the base, or at the limit or above
// on both sides with a higher CRAP in the head.
function judged(entry: FunctionCrap, identity: FunctionCorrespondence | undefined, files: ReadonlyMap<string, FileCrap>): JudgedFunction {
  const base = baseValueOf(identity, files);
  const predecessor = baseEntryOf(identity?.base, files);
  const worse = typeof base === 'number' && predecessor !== undefined && (compareCrap(predecessor, crapLimit) < 0 || compareCrap(entry, predecessor) > 0);
  return { ...entry, base, classification: identity?.classification ?? 'unknown', addedOrWorse: isOver(entry) && (base === 'new' || worse) };
}
