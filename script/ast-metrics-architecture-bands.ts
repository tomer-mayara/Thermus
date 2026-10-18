// The bands of docs/implementation/architecture-evolution-plan.md ("Bands"). A band follows the change: good when no
// function is at CRAP 30 or more, warning when some are but the pull request added or made worse none of them, and
// critical when it added or made worse one.
import { isOver, type FunctionCrap } from './ast-metrics-architecture-crap.ts';
import type { CrapDelta, JudgedFunction } from './ast-metrics-architecture-crap-delta.ts';
import type { Band, MapCommunity, NodeBand } from './ast-metrics-architecture-types.ts';

// Gives the band of the node of a head community and its partner in the base, or of a gone community of the base.
type BandRule = (head: MapCommunity | undefined, base: MapCommunity | undefined) => NodeBand | undefined;

export function bandRuleOf(delta: CrapDelta | undefined): BandRule {
  if (delta === undefined) return () => undefined;
  const headFunctionsOf = (community: MapCommunity) => community.members.flatMap((path) => delta.head.get(path)?.functions ?? []);
  const baseCountOf = (community: MapCommunity) => countOf(community.members.flatMap((path) => delta.base.get(path)?.functions ?? []));
  return (head, base) => nodeBandOf(head && headFunctionsOf(head), base && baseCountOf(base));
}

// The count of the functions at CRAP 30 or more.
export function countOf(functions: readonly FunctionCrap[]): number {
  return functions.filter(isOver).length;
}

// A gone community has the count and the band of the base. The base has no change to follow, so its band is never
// critical. A head community with a partner also gets the band of the partner, so that a change of the band can change
// the map.
function nodeBandOf(functions: readonly JudgedFunction[] | undefined, before: number | undefined): NodeBand {
  if (functions === undefined) return { band: baseBandOf(before ?? 0), count: before ?? 0 };
  const count = countOf(functions);
  if (before === undefined) return { band: bandOf(functions), count };
  return { band: bandOf(functions), count, change: count - before, before: baseBandOf(before) };
}

function bandOf(functions: readonly JudgedFunction[]): Band {
  if (functions.some((entry) => entry.addedOrWorse)) return 'critical';
  return baseBandOf(countOf(functions));
}

function baseBandOf(count: number): Band {
  return count > 0 ? 'warning' : 'good';
}
