// Bands: docs/implementation/ast-metrics-review.md, "Show the architecture delta". A band follows the change: good when no
// function is at CRAP 30 or more, warning when some are but the pull request added or made worse none of them, and
// critical when it added or made worse one.
import type { FunctionCrap } from './crap.ts';
import { countOf, memberFunctionsOf } from './risk-counts.ts';
import type { CrapDelta, JudgedFunction } from './crap-delta.ts';
import type { Band, MapCommunity, NodeBand } from './types.ts';

// Gives the band of the node of a head community and its partner in the base, or of a gone community of the base.
type BandRule = (head: Pick<MapCommunity, 'members'> | undefined, base: Pick<MapCommunity, 'members'> | undefined) => NodeBand | undefined;

export function bandRuleOf(delta: CrapDelta | undefined): BandRule {
  if (delta === undefined) return () => undefined;
  return (head, base) => nodeBandOf(head && riskOf(delta.head, head), base && riskOf(delta.base, base));
}

// A gone community has the count and the band of the base. The base has no change to follow, so its band is never
// critical. A head community with a partner also gets the band of the partner, so that a change of the band can change
// the map.
interface CommunityRisk<T extends FunctionCrap> {
  readonly functions: readonly T[];
  readonly unmeasuredFiles: number;
}

function riskOf<T extends FunctionCrap>(files: ReadonlyMap<string, { readonly functions: readonly T[]; readonly incomplete?: true }>, community: Pick<MapCommunity, 'members'>): CommunityRisk<T> {
  return { functions: memberFunctionsOf(files, community), unmeasuredFiles: community.members.filter((path) => files.get(path)?.incomplete !== undefined || !files.has(path)).length };
}

function nodeBandOf(head: CommunityRisk<JudgedFunction> | undefined, base: CommunityRisk<FunctionCrap> | undefined): NodeBand {
  if (head === undefined) return assessmentOf(base ?? { functions: [], unmeasuredFiles: 0 });
  const assessment = assessmentOf(head);
  const band = head.functions.some((entry) => entry.addedOrWorse) ? 'critical' : assessment.band;
  if (base === undefined) return { ...assessment, band };
  const before = assessmentOf(base);
  return { ...assessment, band, change: assessment.count - before.count, before: before.band };
}

function assessmentOf({ functions, unmeasuredFiles }: CommunityRisk<FunctionCrap>): NodeBand {
  const count = countOf(functions);
  const unknown = functions.filter(({ share }) => share === undefined).length;
  const band: Band | undefined = count > 0 ? 'warning' : unknown + unmeasuredFiles > 0 ? undefined : 'good';
  return { band, count, ...(unknown === 0 ? {} : { unknown }), ...(unmeasuredFiles === 0 ? {} : { unmeasuredFiles }) };
}
