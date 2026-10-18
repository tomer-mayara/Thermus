import type { Band, MapEdge, MapNode, NodeBand } from './ast-metrics-architecture-types.ts';

const bandSymbols: Readonly<Record<Band, string>> = { good: '●', warning: '▲', critical: '■' };

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

// GitHub's renderer fails silently on a double quote or a backtick in a label text, so each becomes a single quote. The
// band, when the report has one, is the third line.
export function nodeTextOf(node: MapNode): string {
  const title = node.status === 'kept' ? node.label : `${node.label} · ${node.status}`;
  const lines = [title.replace(/["`]/g, "'"), numbersOf(node).join(' · ')];
  return (node.band === undefined ? lines : [...lines, bandTextOf(node.band)]).join('<br/>');
}

// The band never comes as a color alone: its line has the symbol and the word, such as ■ critical: 6 fn ≥ 30 (+2). The
// minus sign is U+2212.
function bandTextOf({ band, count, change = 0 }: NodeBand): string {
  const sign = change > 0 ? '+' : '−';
  return `${bandSymbols[band]} ${band}: ${count} fn ≥ 30${change === 0 ? '' : ` (${sign}${Math.abs(change)})`}`;
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

// The change follows the value as an arrow and its size, in the map and in the complexity table. A change that rounds
// to zero, or that has no value, shows nothing.
export function changeText(change: number | undefined, digits: number): string {
  const text = (change ?? 0).toFixed(digits);
  if (Number(text) === 0) return '';
  return text.startsWith('-') ? ` ↓${text.slice(1)}` : ` ↑${text}`;
}
