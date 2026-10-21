import { cycleFacts } from './cycles.ts';
import { packageOf, type ExternalImport, type PackageEdge, type SourceGraph } from './graph.ts';
import { allowsEdge, listedEdge, type GraphRules } from './rules-graph.ts';
import type { Fact } from './types.ts';

// The edges, cycles, packages, and external imports come from the whole tree at HEAD. The imports across packages
// come from the changed files only.
export function factsOf(graph: SourceGraph, rules: { readonly graph: GraphRules; readonly surface: { readonly modules: readonly string[] } }, changed: ReadonlySet<string>): Fact[] {
  return [
    ...packageFacts(graph.packages, rules.graph.packages, rules.graph.components !== undefined),
    ...graph.edges.flatMap((edge) => edgeFacts(edge, rules.graph)),
    ...cycleFacts(graph.edges, rules.graph),
    ...graph.externals.flatMap((use) => externalFacts(use, rules.graph)),
    ...crossPackageFacts(graph, new Set(rules.surface.modules), changed),
  ];
}

function trigger(name: string): string {
  return `dependency_graph.triggers.${name}`;
}

function packageFacts(present: readonly string[], listed: readonly string[], components: boolean): Fact[] {
  const key = components ? 'dependency_graph.components' : 'dependency_graph.packages';
  return [
    ...present.filter((name) => !listed.includes(name)).map((name) => ({ key: trigger('folder_not_listed'), text: name, declare: { key, value: name } })),
    ...listed.filter((name) => !present.includes(name))
      .map((name) => ({ key: trigger('package_removed'), text: `${name} has no files at HEAD`, declare: { key, value: `remove ${name}` } })),
  ];
}

// A forbidden edge has no entry that could allow it.
function edgeFacts(edge: PackageEdge, rules: GraphRules): Fact[] {
  const text = `${edge.from} -> ${edge.to} (${edge.kind})`;
  if (rules.forbiddenEdges.some((rule) => rule.from === edge.from && rule.to.includes(edge.to))) {
    return [{ key: trigger('forbidden_edge'), text, source: edge.source }];
  }
  if (allowsEdge(rules.allowedEdges, edge)) return [];
  const listed = listedEdge(rules.allowedEdges, edge);
  const declare = { key: 'dependency_graph.allowed_edges', value: `{ from: ${edge.from}, to: ${edge.to}, kind: ${edge.kind} }` };
  return [{ key: trigger(listed ? 'type_edge_becomes_runtime' : 'edge_not_listed'), text, declare, source: edge.source }];
}

function externalFacts(use: ExternalImport, rules: GraphRules): Fact[] {
  const list = use.builtin ? 'allowed_node_builtins' : 'allowed_external_imports';
  const allowed = (use.builtin ? rules.nodeBuiltins : rules.externalImports).get(use.owner) ?? [];
  if (allowed.includes(use.name)) return [];
  const declare = { key: `dependency_graph.${list}.${use.owner}`, value: use.name };
  return [{ key: trigger('external_import_not_listed'), text: `${use.owner}: ${use.name}`, declare, source: use.source }];
}

// Composition wires the packages, so its imports need no public surface.
function crossPackageFacts(graph: SourceGraph, surface: ReadonlySet<string>, changed: ReadonlySet<string>): Fact[] {
  const ownerOf = (path: string) => graph.owners?.get(path) ?? packageOf(path);
  return [...graph.imports].filter(([file]) => changed.has(file) && !['composition', 'app'].includes(ownerOf(file))).flatMap(([file, targets]) =>
    [...new Set(targets.map((entry) => entry.target))]
      .filter((target) => ownerOf(target) !== ownerOf(file) && !surface.has(target))
      .map((target) => ({
        key: trigger('cross_package_file_not_in_public_surface'),
        text: `${target} (imported by ${file})`,
        declare: { key: `public_surface.between_packages.${ownerOf(target)}`, value: target },
      })));
}
