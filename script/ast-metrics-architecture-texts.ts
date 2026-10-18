// The texts of the Mermaid graph: the node ids, the node texts, and the edge labels.
import type { MapEdge, MapNode } from './ast-metrics-architecture-types.ts';

// An id is c_ and the label in lower case, with _ for each character outside a-z and 0-9, so that no id is a keyword of
// Mermaid, such as end. A later node with the same id, such as a gone community with the label of a new one, gets a
// number, so that the graph does not join the two nodes.
export function nodeIdsOf(nodes: readonly MapNode[]): Map<MapNode, string> {
  const ids = new Map<MapNode, string>();
  const used = new Set<string>();
  for (const node of nodes) {
    const stem = `c_${node.label.toLowerCase().replace(/[^a-z0-9]/gu, '_')}`;
    let id = stem;
    for (let count = 2; used.has(id); count += 1) id = `${stem}_${count}`;
    used.add(id);
    ids.set(node, id);
  }
  return ids;
}

// GitHub's renderer fails silently on a double quote or a backtick in a label text, so each becomes a single quote.
export function nodeTextOf(node: MapNode): string {
  const title = node.status === 'kept' ? node.label : `${node.label} · ${node.status}`;
  return `${title.replace(/["`]/g, "'")}<br/>${numbersOf(node).join(' · ')}`;
}

// A community without code, such as one of types only, has no maintainability.
function numbersOf({ numbers, change }: MapNode): string[] {
  const files = `${numbers.files} ${numbers.files === 1 ? 'file' : 'files'}${changeText(change?.files, 0)}`;
  const paths = `paths ${numbers.paths}${changeText(change?.paths, 0)}`;
  if (numbers.maintainability === undefined) return [files, paths];
  return [files, `MI ${numbers.maintainability.toFixed(1)}${changeText(change?.maintainability, 1)}`, paths];
}

// A gone dependency has the label gone. The style of the edge also shows a cycle and a new dependency, but the label
// names both, because a cycle edge is dashed also when it is new.
export function edgeLabelOf(edge: MapEdge): string {
  if (edge.status === 'gone') return 'gone';
  const parts = [`${edge.references}${changeText(edge.change, 0)}`];
  if (edge.status === 'new') parts.push('new');
  if (edge.inCycle) parts.push('cycle');
  return parts.join(' · ');
}

// The change follows the value as an arrow and its size. A change that rounds to zero, or that has no value, shows
// nothing.
function changeText(change: number | undefined, digits: number): string {
  const text = (change ?? 0).toFixed(digits);
  if (Number(text) === 0) return '';
  return text.startsWith('-') ? ` ↓${text.slice(1)}` : ` ↑${text}`;
}
