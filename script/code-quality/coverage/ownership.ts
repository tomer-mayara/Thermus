import type { MergedFunction, MergedScript } from './merge.ts';
import { CommandError } from '../shared/repository.ts';

type CharacterRange = { readonly start: number; readonly end: number };

function strictlyContains(parent: CharacterRange, child: CharacterRange): boolean {
  const parentLength = parent.end - parent.start;
  const childLength = child.end - child.start;
  return parent.start <= child.start && child.end <= parent.end && parentLength > childLength;
}

function validateOwnership(path: string, ranges: readonly CharacterRange[]): void {
  const ordered = [...ranges].sort((first, second) => first.start - second.start || second.end - first.end);
  ordered.forEach((first, index) => {
    for (const second of ordered.slice(index + 1)) {
      if (second.start < first.end && first.end < second.end) {
        throw new CommandError(`Crossing function ranges in ${path}: [${first.start},${first.end}) and [${second.start},${second.end}).`);
      }
    }
  });
}

// Ownership uses all processes, including helpers, before helpers and their descendants leave the report.
export function applyOwnership(script: MergedScript): void {
  const functions = [...script.functions.values()];
  validateOwnership(script.path, functions);
  const helpers = functions.filter(({ name }) => name.startsWith('__'));
  for (const [key, entry] of script.functions) {
    subtractNested(entry, functions);
    if (entry.name.startsWith('__') || helpers.some((helper) => strictlyContains(helper, entry))) script.functions.delete(key);
  }
}

function subtractNested(entry: MergedFunction, functions: readonly MergedFunction[]): void {
  const own = new Uint8Array(entry.end - entry.start).fill(1);
  for (const nested of functions) {
    if (strictlyContains(entry, nested)) own.fill(0, nested.start - entry.start, nested.end - entry.start);
  }
  entry.ownCharacters = 0;
  for (let index = 0; index < own.length; index += 1) {
    entry.ownCharacters += own[index];
    entry.covered[index] &= own[index];
  }
}
