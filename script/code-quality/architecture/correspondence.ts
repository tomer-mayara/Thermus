import { bodyKey, completeSource, functionsIn, uniqueDeclaration, type Entries, type LocatedFunction, type Pairs } from './function-evidence.ts';
import { declarationPairs } from './declaration-correspondence.ts';
import { addUniqueMoves } from './move-correspondence.ts';
import type { MapFunction, MapSources } from './types.ts';

export interface FunctionCorrespondence {
  readonly classification: 'unchanged' | 'changed' | 'new' | 'unknown';
  readonly base?: LocatedFunction;
}

export interface Correspondence {
  readonly head: ReadonlyMap<MapFunction, FunctionCorrespondence>;
  readonly base: ReadonlyMap<MapFunction, LocatedFunction>;
}

export function correspondenceOf(sources: MapSources): Correspondence {
  const base = functionsIn(sources.base), head = functionsIn(sources.head);
  const pairs = declarationPairs(sources, { base, head });
  addUniqueMoves({ base, head }, pairs);
  return classificationsOf(sources, { base, head }, pairs);
}

function classificationsOf(sources: MapSources, entries: Entries, pairs: Pairs): Correspondence {
  const reverse = new Map<MapFunction, LocatedFunction>();
  for (const entry of entries.head) {
    const partner = pairs.get(entry.fn);
    if (partner !== undefined) reverse.set(partner.fn, entry);
  }
  const absenceProven = sources.base.files.every(completeSource) && entries.base.every(({ fn }) => reverse.has(fn));
  const head = entries.head.map(({ file, fn }): [MapFunction, FunctionCorrespondence] => {
    const partner = pairs.get(fn);
    if (partner !== undefined) return [fn, { classification: bodyKey(fn) === bodyKey(partner.fn) ? 'unchanged' : 'changed', base: partner }];
    const copiedBody = entries.base.some((entry) => bodyKey(entry.fn) === bodyKey(fn));
    const isNew = absenceProven && !copiedBody && completeSource(file) && uniqueDeclaration({ file, fn }, entries.head);
    return [fn, { classification: isNew ? 'new' : 'unknown' }];
  });
  return { head: new Map(head), base: reverse };
}
