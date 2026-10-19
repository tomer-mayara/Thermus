import { bodyKey, uniqueBy, uniqueDeclaration, type Entries, type LocatedFunction, type Pairs } from './function-evidence.ts';

export function addUniqueMoves(entries: Entries, pairs: Pairs): void {
  const keyOf = ({ fn }: LocatedFunction) => bodyKey(fn);
  const before = uniqueBy(entries.base, keyOf), after = uniqueBy(entries.head, keyOf);
  const used = new Set([...pairs.values()].map(({ fn }) => fn));
  for (const [key, entry] of after) {
    const partner = before.get(key);
    if (partner === undefined || !uniqueDeclaration(entry, entries.head) || !uniqueDeclaration(partner, entries.base) || pairs.has(entry.fn) || used.has(partner.fn)) continue;
    pairs.set(entry.fn, partner);
    used.add(partner.fn);
  }
}
