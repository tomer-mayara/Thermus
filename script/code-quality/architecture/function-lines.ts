import type { JudgedFunction } from './crap-delta.ts';
import { textOrder } from './order.ts';

interface ListedFunction {
  readonly path: string;
  // ast-metrics names a method module\Class.method, and the path names the module already.
  readonly name: string;
  readonly crap: JudgedFunction;
}

export function addedOrWorseLines(path: string, functions: readonly JudgedFunction[]): string[] {
  const listed = functions.filter((crap) => crap.addedOrWorse).map((crap) => ({ path, name: crap.name.replace(/^[^\\]*\\/u, ''), crap }));
  return listed.sort((first, second) => textOrder(first.name, second.name)).map(lineOf);
}

// A share keeps two decimals and a CRAP one, as the formula gives them.
function lineOf({ path, name, crap }: ListedFunction): string {
  const base = typeof crap.base === 'number' ? crap.base.toFixed(1) : 'new';
  const covered = crap.share === undefined ? 'unknown' : crap.share.toFixed(2);
  const value = crap.share === undefined ? `≥ ${crap.paths}` : crap.crap.toFixed(1);
  return `- \`${path}\` \`${name}\`: paths ${crap.paths}, covered ${covered}, CRAP ${value} (base ${base})`;
}

export function unmeasuredLines(path: string, functions: readonly JudgedFunction[]): string[] {
  const entries = functions.filter(({ share, paths }) => share === undefined && paths >= 5);
  return entries.map(({ name, paths }) => ({ name: name.replace(/^[^\\]*\\/u, ''), paths }))
    .sort((first, second) => textOrder(first.name, second.name))
    .map(({ name, paths }) => `- \`${path}\` \`${name}\`: paths ${paths}, covered unknown, CRAP ≥ ${paths}`);
}
