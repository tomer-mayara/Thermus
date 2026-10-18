// The labels of the src/ communities. ast-metrics regroups and renames its communities when code grows elsewhere, so a
// label comes from the members, not from the generated name: the largest namespace in src/ by member count, without
// the src/ prefix. The files at the top of src/ give the label src.
import type { Namespace, ServerCommunity } from './ast-metrics-snapshot-communities.ts';

export function labelsOf(communities: readonly ServerCommunity[]): ReadonlyMap<string, string> {
  const named = communities.map((community) => ({ community, label: namespaceLabel(community) }));
  const uses = new Map<string, number>();
  for (const { label } of named) uses.set(label, (uses.get(label) ?? 0) + 1);
  return new Map(named.map(({ community, label }) => [community.id, (uses.get(label) ?? 0) > 1 ? `${label} (${hubName(community)})` : label]));
}

function namespaceLabel(community: ServerCommunity): string {
  if (community.id === 'shared') return 'shared kernel';
  const [largest] = community.namespaces.filter(isSourceNamespace).toSorted(byCountThenName);
  return largest === undefined ? 'src' : largest.namespace.replace(/^src\//, '');
}

// A community can hold files of other folders too, such as script/.
function isSourceNamespace({ namespace }: Namespace): boolean {
  return namespace === 'src' || namespace.startsWith('src/');
}

// A tie goes to the first name, so that the label does not depend on the order of the answer.
function byCountThenName(first: Namespace, second: Namespace): number {
  return second.count - first.count || (first.namespace < second.namespace ? -1 : 1);
}

// A hub is a file without its extension or a folder.
function hubName({ id, hubs }: ServerCommunity): string {
  const hub = hubs[0] ?? id;
  return hub.slice(hub.lastIndexOf('/') + 1);
}
