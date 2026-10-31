import { changedPathsOf } from './changes.ts';
import type { FilePair } from './git-reads.ts';
import type { GraphRules } from './rules-graph.ts';
import { isRecord } from './rules-values.ts';
import type { DependencyRules, Rules } from './rules.ts';
import type { Change, FactGroup, Reason } from './types.ts';

// The sections of a manifest that select third-party code. The pnpm block selects it too: its overrides, patches,
// and build permissions. overrides and resolutions are the version overrides of npm and yarn.
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'pnpm', 'overrides', 'resolutions'] as const;

type Allowed = ReadonlyMap<string, readonly string[]>;

export interface DependencyInput {
  readonly changes: readonly Change[];
  readonly manifest?: FilePair;
}

interface ManifestChange {
  readonly facts: readonly string[];
  readonly notes: readonly string[];
  readonly blockers: readonly Reason[];
}

const unchanged: ManifestChange = { facts: [], notes: [], blockers: [] };

// The facts of the section dependencies of the merge base. Each is T1 Team review.
export function dependencyGroups(input: DependencyInput, rules: { readonly base: Rules; readonly head: Rules }): FactGroup[] {
  const dependencies = rules.base.dependencies;
  if (dependencies === undefined) return [];
  return [importGroup(rules.base.graph, rules.head.graph), manifestGroup(input, dependencies)];
}

// A component gains an npm package or a Node builtin when the rules of HEAD list it for the component and the rules
// of the merge base do not.
function importGroup(base: GraphRules, head: GraphRules): FactGroup {
  const added = [...gainedOf(base.externalImports, head.externalImports), ...gainedOf(base.nodeBuiltins, head.nodeBuiltins)];
  const removed = [...gainedOf(head.externalImports, base.externalImports), ...gainedOf(head.nodeBuiltins, base.nodeBuiltins)];
  return {
    tier: 'T1', facts: added.map((fact) => ({ key: 'dependencies.external_import_added', fact })),
    summary: `${counted(added.length, 'external import')} added`, notes: removed.map((entry) => `external import removed: ${entry}`),
  };
}

function gainedOf(before: Allowed, after: Allowed): string[] {
  return [...after].flatMap(([owner, names]) => names.filter((name) => !(before.get(owner) ?? []).includes(name)).map((name) => `${owner}: ${name}`));
}

// A dependency key that the manifest adds or removes is a fact. A changed version, and a changed lockfile alone, are
// notes.
function manifestGroup(input: DependencyInput, rules: DependencyRules): FactGroup {
  const change = input.manifest === undefined || input.manifest.base === input.manifest.head ? unchanged : manifestChangeOf(input.manifest, rules.manifest);
  const lockfile = rules.lockfile !== undefined && change.facts.length === 0 && changedPathsOf(input.changes).includes(rules.lockfile);
  return {
    tier: 'T1', facts: change.facts.map((fact) => ({ key: 'dependencies.keys_changed', fact })),
    summary: `${counted(change.facts.length, 'dependency key')} added or removed`,
    notes: [...change.notes, ...(lockfile ? [`${rules.lockfile} changed; the dependency keys of ${rules.manifest} stay the same`] : [])],
    blockers: change.blockers,
  };
}

function manifestChangeOf(pair: FilePair, manifest: string): ManifestChange {
  const base = entriesOf(pair.base);
  const head = entriesOf(pair.head);
  if (base === undefined || head === undefined) {
    const where = base === undefined ? 'at the merge base' : 'at HEAD';
    return { ...unchanged, blockers: [{ blocking: true, key: 'dependencies.keys_changed', fact: `${manifest} ${where} is not a JSON object, so the check cannot compare its dependency keys` }] };
  }
  const added = [...head.keys()].filter((key) => !base.has(key)).map((key) => `${manifest}: ${key} added`);
  const removed = [...base.keys()].filter((key) => !head.has(key)).map((key) => `${manifest}: ${key} removed`);
  const versions = [...head].filter(([key, value]) => base.has(key) && base.get(key) !== value).map(([key, value]) => `${key} ${base.get(key)} -> ${value}`);
  return { facts: [...added, ...removed], notes: versions.length > 0 ? [`${manifest}: versions changed: ${versions.join(', ')}`] : [], blockers: [] };
}

// The entries of a manifest by key path, such as dependencies.jose, with the value of each: its version. An item of
// a list is a key with no value. A missing manifest has no entries; text that is not a JSON object gives undefined.
function entriesOf(text: string | undefined): Map<string, string> | undefined {
  if (text === undefined) return new Map();
  let manifest: unknown;
  try { manifest = JSON.parse(text); }
  catch { return undefined; }
  if (!isRecord(manifest)) return undefined;
  const entries = new Map<string, string>();
  for (const section of sections) addEntries(entries, section, manifest[section]);
  return entries;
}

function addEntries(entries: Map<string, string>, key: string, value: unknown): void {
  if (isRecord(value)) for (const [name, inner] of Object.entries(value)) addEntries(entries, `${key}.${name}`, inner);
  else if (Array.isArray(value)) for (const item of value) entries.set(`${key}[${JSON.stringify(item)}]`, '');
  else if (value !== undefined) entries.set(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
