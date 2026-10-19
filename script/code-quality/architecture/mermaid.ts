// The Mermaid graph of the encoding of docs/implementation/architecture-evolution-plan.md: the border width shows a
// touched community, the border color its band, and the line of an edge shows a cycle, a new, or a gone dependency.
import { changeText } from './format.ts';
import { bandTextOf } from './band-label.ts';
import type { ArchitectureMap, Band, MapEdge, MapNode } from './types.ts';

const cycleStyle = 'stroke:#d03b3b,stroke-width:2px';
const goneStyle = 'stroke:#999999,stroke-dasharray:4 4';

// The fixed status colors of the plan, in the order of the class lines. A band class sets the color only: a width of its
// own would replace the thick border of a touched community, because a later class wins.
const bandColors: readonly (readonly [Band, string])[] = [['good', '#0ca30c'], ['warning', '#fab219'], ['critical', '#d03b3b']];

// The lines of the fenced block, from the opening fence to the closing one.
export function mermaidOf(map: ArchitectureMap): string[] {
  const ids = nodeIdsOf(map.nodes);
  const idOf = (node: MapNode): string => ids.get(node) ?? '';
  const bands = bandColors.map(([band, color]) => ({ band, color, ids: map.nodes.filter((node) => node.band?.band === band).map(idOf) })).filter((entry) => entry.ids.length > 0);
  return [
    '```mermaid',
    'flowchart LR',
    ...map.nodes.map((node) => `  ${idOf(node)}["${nodeTextOf(node)}"]`),
    ...map.edges.map((edge) => `  ${idOf(edge.from)} ${arrowOf(edge)} ${idOf(edge.to)}`),
    ...map.edges.flatMap(linkStyleOf),
    '  classDef touched stroke-width:3px',
    '  classDef gone stroke-dasharray:4 4,color:#999999',
    ...bands.map(({ band, color }) => `  classDef ${band} stroke:${color}`),
    ...classLines('touched', map.nodes.filter((node) => node.touched).map(idOf)),
    ...classLines('gone', map.nodes.filter((node) => node.status === 'gone').map(idOf)),
    ...bands.flatMap(({ band, ids: banded }) => classLines(band, banded)),
    '```',
  ];
}

function arrowOf(edge: MapEdge): string {
  const label = `"${edgeLabelOf(edge)}"`;
  if (edge.status === 'gone' || edge.inCycle) return `-. ${label} .->`;
  return edge.status === 'new' ? `== ${label} ==>` : `-- ${label} -->`;
}

// The index of a link style is the position of its edge among the edge lines, from 0.
function linkStyleOf(edge: MapEdge, index: number): string[] {
  if (edge.status === 'gone') return [`  linkStyle ${index} ${goneStyle}`];
  return edge.inCycle ? [`  linkStyle ${index} ${cycleStyle}`] : [];
}

function classLines(name: string, ids: readonly string[]): string[] {
  return ids.length === 0 ? [] : [`  class ${ids.join(',')} ${name}`];
}

// An id is c_ and the label in lower case, with _ for each character outside a-z and 0-9, so that no id is a keyword of
// Mermaid, such as end. A later node with the same id, such as a gone community with the label of a new one, gets a
// number, so that the graph does not join the two nodes.
function nodeIdsOf(nodes: readonly MapNode[]): Map<MapNode, string> {
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
function nodeTextOf(node: MapNode): string {
  const title = node.status === 'kept' ? node.label : `${node.label} · ${node.status}`;
  const lines = [title.replace(/["`]/g, "'"), numbersOf(node).join(' · ')];
  return (node.band === undefined ? lines : [...lines, bandTextOf(node.band)]).join('<br/>');
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
function edgeLabelOf(edge: MapEdge): string {
  if (edge.status === 'gone') return 'gone';
  const parts = [`${edge.references}${changeText(edge.change, 0)}`];
  if (edge.status === 'new') parts.push('new');
  if (edge.inCycle) parts.push('cycle');
  return parts.join(' · ');
}
