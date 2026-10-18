// The shape of the answer of get_communities with members follows ast-metrics 0.43.1.
import { isJsonObject, jsonOf, objectOf } from './ast-metrics-json.ts';
import { arrayOf, numberOrZero, textOf, textsOf } from './ast-metrics-snapshot-json.ts';
import type { CommunityReferences } from './ast-metrics-snapshot-types.ts';
import { CommandError } from './repository.ts';

export interface ServerCommunities {
  readonly modularity: number;
  readonly crossShare: number;
  // The ids of the communities in each cycle.
  readonly cycles: readonly (readonly string[])[];
  readonly communities: readonly ServerCommunity[];
  readonly edges: readonly ServerEdge[];
}

// The shared kernel has the id "shared". A member is a unit of the dependency graph: a file without its extension, or a
// folder whose files ast-metrics groups into one unit.
export interface ServerCommunity {
  readonly id: string;
  readonly hubs: readonly string[];
  readonly members: readonly string[];
  readonly namespaces: readonly Namespace[];
  readonly references: CommunityReferences;
}

export interface Namespace {
  readonly namespace: string;
  readonly count: number;
}

export interface ServerEdge {
  readonly from: string;
  readonly to: string;
  readonly references: number;
  readonly inCycle: boolean;
}

// ast-metrics leaves out each value of zero, so the parse accepts a missing value, and an entry that is not an object
// gives no values.
export function serverCommunitiesOf(text: string): ServerCommunities {
  const answer = jsonOf(text);
  if (!isJsonObject(answer)) throw new CommandError('get_communities gave an unexpected answer: expected a JSON object.');
  return {
    modularity: numberOrZero(answer.modularity),
    crossShare: numberOrZero(answer.crossShare),
    cycles: arrayOf(answer.cycles).map(textsOf),
    communities: arrayOf(answer.communities).map(communityOf),
    edges: arrayOf(answer.edges).map(edgeOf),
  };
}

function communityOf(entry: unknown): ServerCommunity {
  const fields = objectOf(entry);
  return {
    id: textOf(fields.id) ?? '',
    hubs: textsOf(fields.hubs),
    members: textsOf(fields.members),
    namespaces: arrayOf(fields.namespaces).map(namespaceOf),
    references: { internal: numberOrZero(fields.internalReferences), inbound: numberOrZero(fields.inboundReferences), outbound: numberOrZero(fields.outboundReferences) },
  };
}

function namespaceOf(entry: unknown): Namespace {
  const fields = objectOf(entry);
  return { namespace: textOf(fields.namespace) ?? '', count: numberOrZero(fields.count) };
}

function edgeOf(entry: unknown): ServerEdge {
  const fields = objectOf(entry);
  return { from: textOf(fields.from) ?? '', to: textOf(fields.to) ?? '', references: numberOrZero(fields.references), inCycle: fields.inCycle === true };
}
