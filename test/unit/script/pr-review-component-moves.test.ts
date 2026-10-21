import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';
import type { GraphRules } from '../../../script/pr-review/rules-graph.ts';
import type { Change } from '../../../script/pr-review/types.ts';

const { sourceOutcome } = await import(new URL('sources.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/sources.ts');
const before = 'src/a/source.ts';
const after = 'src/group/new-a/source.ts';
const targetBefore = 'src/b/target.ts';
const targetAfter = 'src/group/new-b/target.ts';
const moves: Change[] = [{ status: 'R100', oldPath: before, path: after }, { status: 'R100', oldPath: targetBefore, path: targetAfter }];

function policy(edits: Partial<GraphRules> = {}, surface = [targetBefore]) {
  return { graph: { packages: ['a', 'b'], allowedEdges: [{ from: 'a', to: 'b', kind: 'type' as const }], forbiddenEdges: [], knownCycles: [], externalImports: new Map(), nodeBuiltins: new Map(), ...edits }, surface: { modules: surface, contractDocuments: [] } };
}
const nested = { aa: { roots: ['src/group/new-a/'] }, bb: { roots: ['src/group/new-b/'] } };

interface CandidateScenario {
  readonly base?: ReturnType<typeof policy>;
  readonly head?: ReturnType<typeof policy>;
  readonly changes?: readonly Change[];
}

function outcome(text: string, scenario: CandidateScenario = {}) {
  const base = scenario.base ?? policy();
  const head = scenario.head ?? policy({ packages: ['aa', 'bb'], components: nested, allowedEdges: [{ from: 'aa', to: 'bb', kind: 'runtime' }] }, [targetAfter]);
  const sources = new Map([[after, text], [targetAfter, 'export interface Value {}\n']]);
  return sourceOutcome({ sourcePaths: [...sources.keys()], sources, changes: scenario.changes ?? moves }, { base, head }, [after, targetAfter]);
}

test('Given proven renames and a new forbidden import, when ownership changes, then the merge-base prohibition still blocks it even if HEAD permits it', () => {
  const result = outcome("import type { Value } from '../new-b/target.ts';", { base: policy({ forbiddenEdges: [{ from: 'a', to: ['b'] }] }) });
  assert.ok(result.facts.fix.some((fact) => fact.key.endsWith('forbidden_edge') && fact.text === 'a -> b (type)'));
});

test('Given renamed files and runtime escalation, when HEAD declares the stronger kind, then the old type boundary remains an explicit declaration for review', () => {
  const result = outcome("import { type Value } from '../new-b/target.ts';");
  assert.ok(result.facts.declared.some((fact) => fact.key.endsWith('type_edge_becomes_runtime') && fact.text === 'a -> b (runtime)'));
});

test('Given a renamed private target made public by HEAD, when checked, then the old private access still needs an explicit declaration', () => {
  const result = outcome("import type { Value } from '../new-b/target.ts';", { base: policy({}, []) });
  assert.ok(result.facts.declared.some((fact) => fact.key.endsWith('cross_package_file_not_in_public_surface') && fact.text.includes(targetAfter)));
});

test('Given a regrouped external import, when HEAD grants the new owner access, then the old owner remains visible in the declaration', () => {
  const head = policy({ packages: ['aa', 'bb'], components: nested, allowedEdges: [], externalImports: new Map([['aa', ['jose']]]) }, [targetAfter]);
  const result = outcome("import 'jose';", { head });
  assert.ok(result.facts.declared.some((fact) => fact.text === 'a: jose'));
});

test('Given unproven deletion and addition, when the new owner is evaluated, then no old source identity is inferred from similar names', () => {
  const changes = [{ status: 'D', path: before }, { status: 'A', path: after }, moves[1]];
  const result = outcome("import type { Value } from '../new-b/target.ts';", { changes });
  assert.ok(result.facts.declared.some((fact) => fact.key.endsWith('folder_not_listed')));
  assert.ok(result.facts.declared.some((fact) => fact.key.endsWith('edge_not_listed') && !fact.text.startsWith('a ->')));
});

test('Given a known all-type cycle and a renamed runtime escalation, when HEAD declares it, then the known cycle cannot grow', () => {
  const base = policy({ knownCycles: [{ members: ['a', 'b'], kind: 'all' }] });
  const result = outcome("import { type Value } from '../new-b/target.ts';", { base });
  assert.ok(result.facts.fix.some((fact) => fact.key.endsWith('known_cycle_grows')));
});

test('Given an ownership-only regrouping of unchanged files, when a private dependency becomes internal to the new owner, then the old private access remains visible', () => {
  const base = policy({ components: { a: { roots: ['src/group/new-a/'] }, b: { roots: ['src/group/new-b/'] } } }, []);
  const head = policy({ packages: ['merged'], components: { merged: { roots: ['src/group/'] } }, allowedEdges: [] }, []);
  const sources = new Map([[after, "import type { Value } from '../new-b/target.ts';"], [targetAfter, 'export interface Value {}']]);
  const result = sourceOutcome({ sourcePaths: [...sources.keys()], sources, changes: [] }, { base, head }, []);
  assert.ok(result.facts.declared.some((fact) => fact.key.endsWith('cross_package_file_not_in_public_surface')));
});
