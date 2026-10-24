import { textOrder } from '../code-quality/shared/order.ts';
import type { ComponentDefinitions } from '../component-ownership.ts';
import type { FilePair } from './git-reads.ts';
import { anyGlobMatches } from './globs.ts';
import { viewChangeOf } from './registry-views.ts';
import { listedEdge, type GraphRules } from './rules-graph.ts';
import type { Rules } from './rules.ts';
import type { SnapshotDifference } from './surface-snapshot.ts';
import type { ArchitectureFact, Change, FactGroup } from './types.ts';

type Component = ComponentDefinitions[string];
type Edge = GraphRules['allowedEdges'][number];

export interface ArchitectureInput {
  readonly changes: readonly Change[];
  readonly registry?: FilePair;
  readonly differences: readonly SnapshotDifference[];
}

// The rules of HEAD declare the components, the allowed edges, and the public modules that the merge would bring;
// the rules of the merge base are the trusted state.
export function architectureGroups(input: ArchitectureInput, rules: { readonly base: Rules; readonly head: Rules }): FactGroup[] {
  const { base, head } = rules;
  if (base.architecture === undefined) return [];
  return [
    componentGroup(base.graph.components ?? {}, head.graph.components ?? {}),
    edgeGroup(base.graph.allowedEdges, head.graph.allowedEdges),
    moduleGroup(base.surface.modules, head.surface.modules),
    declarationGroup(input.differences),
    registryGroup(base.architecture.registry, input.registry),
    decisionGroup(input.changes, base.architecture.decisions),
  ];
}

// The order of the roots and of the files does not count.
function componentGroup(base: ComponentDefinitions, head: ComponentDefinitions): FactGroup {
  const ids = [...new Set([...Object.keys(base), ...Object.keys(head)])].sort(textOrder);
  const facts = ids.flatMap((id) => componentFactOf(id, base[id], head[id]) ?? []);
  return { tier: 'T2', facts: factsOf('component_set', facts), summary: `component set changed for ${counted(facts.length, 'component')}` };
}

function componentFactOf(id: string, before?: Component, after?: Component): string | undefined {
  if (before === undefined) return after && `${id} added (${placeOf(after)})`;
  if (after === undefined) return `${id} removed (${placeOf(before)})`;
  return placeOf(before) === placeOf(after) ? undefined : `${id} changed (${placeOf(before)} -> ${placeOf(after)})`;
}

function placeOf(component: Component): string {
  const lists = [['roots', component.roots], ['files', component.files ?? []]] as const;
  return lists.filter(([, paths]) => paths.length > 0).map(([name, paths]) => `${name} ${[...paths].sort(textOrder).join(', ')}`).join('; ');
}

// A removed or a narrowed edge allows less, so it is a note.
function edgeGroup(base: readonly Edge[], head: readonly Edge[]): FactGroup {
  const changes = head.map((edge) => edgeChangeOf(edge, base));
  const facts = changes.flatMap((change) => change.fact ?? []);
  const removed = base.filter((edge) => listedEdge(head, edge) === undefined).map((edge) => `allowed edge removed: ${edge.from} -> ${edge.to} (${edge.kind})`);
  return {
    tier: 'T2', facts: factsOf('dependency_added', facts), summary: `${counted(facts.length, 'allowed edge')} added or widened`,
    notes: [...changes.flatMap((change) => change.note ?? []), ...removed],
  };
}

// The kind of an allowed edge is a maximum: type allows type imports only, and runtime and both allow any import.
// Thus only the step from type to runtime or both widens an edge.
function edgeChangeOf(edge: Edge, base: readonly Edge[]): { readonly fact?: string; readonly note?: string } {
  const name = `${edge.from} -> ${edge.to}`;
  const before = listedEdge(base, edge);
  if (before === undefined) return { fact: `${name} (${edge.kind}) added` };
  if (before.kind === edge.kind) return {};
  if (before.kind === 'type') return { fact: `${name} (type -> ${edge.kind}) widened` };
  return edge.kind === 'type' ? { note: `allowed edge narrowed: ${name} (${before.kind} -> type)` } : {};
}

function moduleGroup(base: readonly string[], head: readonly string[]): FactGroup {
  const added = [...new Set(head)].filter((module) => !base.includes(module));
  const removed = [...new Set(base)].filter((module) => !head.includes(module));
  return {
    tier: 'T2', facts: factsOf('public_module_added', added), summary: `${counted(added.length, 'public module')} added`,
    notes: removed.map((module) => `public module removed: ${module}`),
  };
}

// The snapshot of a new public module comes with the fact public_module_added, so an added snapshot is a note.
function declarationGroup(differences: readonly SnapshotDifference[]): FactGroup {
  const changed = differences.filter((difference) => difference.status === 'changed');
  const facts = changed.map((difference): ArchitectureFact => ({
    key: 'architecture.declarations_changed', fact: `${difference.module} (+${difference.added} -${difference.removed} lines)`, detail: difference.diff,
  }));
  const others = differences.filter((difference) => difference.status !== 'changed');
  return {
    tier: 'T2', facts, summary: `declarations changed in ${counted(facts.length, 'public module')}`,
    notes: others.map((difference) => `declaration snapshot ${difference.status}: ${difference.module}`),
  };
}

// A registry that one revision lacks has no views there. Views in another order alone are a note.
function registryGroup(registry: string, pair: FilePair | undefined): FactGroup {
  const change = viewChangeOf(pair?.base ?? '', pair?.head ?? '');
  const counts = ([['added', change.added], ['removed', change.removed], ['edited', change.edited]] as const).filter(([, count]) => count > 0);
  const text = (noun: string) => counts.map(([verb, count]) => `${counted(count, noun)} ${verb}`).join(', ');
  return {
    tier: 'T2', facts: counts.length > 0 ? factsOf('registry_view_changed', [`${registry}: ${text('view')}`]) : [], summary: text('registry view'),
    notes: change.reordered ? [`${registry}: views reordered, no view changed`] : [],
  };
}

// A rename that brings a file under the decisions adds a record there too.
function decisionGroup(changes: readonly Change[], decisions: readonly string[]): FactGroup {
  const added = changes.filter((change) => anyGlobMatches(decisions, change.path)
    && (change.status === 'A' || (change.oldPath !== undefined && !anyGlobMatches(decisions, change.oldPath))));
  return { tier: 'T2', facts: factsOf('decision_record', added.map((change) => `${change.path} added`)), summary: `${counted(added.length, 'decision record')} added` };
}

function factsOf(name: string, texts: readonly string[]): ArchitectureFact[] {
  return texts.map((fact) => ({ key: `architecture.${name}`, fact }));
}

function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
