// The Mermaid graph of the encoding of docs/implementation/architecture-evolution-plan.md: the border width shows a
// touched community, the border color its band, and the line of an edge shows a cycle, a new, or a gone dependency.
import { edgeLabelOf, nodeIdsOf, nodeTextOf } from './ast-metrics-architecture-texts.ts';
import type { ArchitectureMap, Band, MapEdge, MapNode } from './ast-metrics-architecture-types.ts';

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
