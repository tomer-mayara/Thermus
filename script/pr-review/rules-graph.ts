import { componentDefinitionsOf, type ComponentDefinitions } from '../component-ownership.ts';
import { invalidKey, isRecord, isTextList, listAt, listsAt, textListAt, valueAt } from './rules-values.ts';

// The section dependency_graph of the rules file. The kind of an allowed edge is the maximum: type allows type
// imports only; runtime and both allow any import.
type EdgeKind = 'type' | 'runtime' | 'both';

interface AllowedEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
}

interface ForbiddenEdge {
  readonly from: string;
  readonly to: readonly string[];
}

export interface KnownCycle {
  readonly members: readonly string[];
  readonly kind: 'runtime' | 'all';
}

export interface GraphRules {
  readonly components?: ComponentDefinitions;
  readonly packages: readonly string[];
  readonly allowedEdges: readonly AllowedEdge[];
  readonly forbiddenEdges: readonly ForbiddenEdge[];
  readonly knownCycles: readonly KnownCycle[];
  readonly externalImports: ReadonlyMap<string, readonly string[]>;
  readonly nodeBuiltins: ReadonlyMap<string, readonly string[]>;
}

interface Section {
  readonly document: unknown;
  readonly where: string;
}

interface ItemReader<T> {
  readonly read: (item: unknown) => T | undefined;
  readonly expected: string;
}

export function graphRulesOf(document: unknown, where: string): GraphRules {
  const components = componentDefinitionsOf(valueAt(document, 'dependency_graph.components'), where);
  if (components !== undefined && valueAt(document, 'dependency_graph.packages') !== undefined) throw invalidKey(where, 'dependency_graph', 'use components or legacy packages, not both');
  const section = { document, where };
  const allowedEdges = itemsAt(section, 'allowed_edges', { read: allowedEdgeOf, expected: 'give from, to, and a kind of type, runtime, or both' });
  const repeated = allowedEdges.findIndex((edge, index) => allowedEdges.findIndex((other) => other.from === edge.from && other.to === edge.to) !== index);
  if (repeated >= 0) throw invalidKey(where, `dependency_graph.allowed_edges[${repeated}]`, 'list each pair of from and to once');
  return {
    components,
    packages: components === undefined ? textListAt(document, 'dependency_graph.packages', where) : Object.keys(components),
    allowedEdges,
    forbiddenEdges: itemsAt(section, 'forbidden_edges', { read: forbiddenEdgeOf, expected: 'give from, and to as a text or a list of text' }),
    knownCycles: itemsAt(section, 'known_cycles', { read: knownCycleOf, expected: 'give two or more members and a kind of runtime or all' }),
    externalImports: listsAt(document, 'dependency_graph.allowed_external_imports', where),
    nodeBuiltins: listsAt(document, 'dependency_graph.allowed_node_builtins', where),
  };
}

export function listedEdge(edges: readonly AllowedEdge[], edge: { readonly from: string; readonly to: string }): AllowedEdge | undefined {
  return edges.find((rule) => rule.from === edge.from && rule.to === edge.to);
}

export function allowsEdge(edges: readonly AllowedEdge[], edge: { readonly from: string; readonly to: string; readonly kind: 'type' | 'runtime' }): boolean {
  const listed = listedEdge(edges, edge);
  return listed !== undefined && (listed.kind !== 'type' || edge.kind === 'type');
}

function itemsAt<T>(section: Section, name: string, reader: ItemReader<T>): T[] {
  const key = `dependency_graph.${name}`;
  return listAt(section.document, key, section.where).map((item, index) => {
    const value = reader.read(item);
    if (value === undefined) throw invalidKey(section.where, `${key}[${index}]`, reader.expected);
    return value;
  });
}

function allowedEdgeOf(item: unknown): AllowedEdge | undefined {
  if (!isRecord(item) || !isText(item.from) || !isText(item.to)) return undefined;
  const kind = item.kind;
  return kind === 'type' || kind === 'runtime' || kind === 'both' ? { from: item.from, to: item.to, kind } : undefined;
}

function forbiddenEdgeOf(item: unknown): ForbiddenEdge | undefined {
  if (!isRecord(item) || !isText(item.from)) return undefined;
  const to = isText(item.to) ? [item.to] : item.to;
  return isTextList(to) && to.length > 0 ? { from: item.from, to } : undefined;
}

// The check reads the members and the kind of a known cycle. Its edges and its plan to resolve it are for people.
function knownCycleOf(item: unknown): KnownCycle | undefined {
  if (!isRecord(item) || !isTextList(item.members) || item.members.length < 2) return undefined;
  return item.kind === 'runtime' || item.kind === 'all' ? { members: item.members, kind: item.kind } : undefined;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}
