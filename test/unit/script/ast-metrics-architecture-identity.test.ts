import { createHash } from 'node:crypto';
import type { FileChange } from '../../../script/code-quality/delta/changes.ts';
import type { MapFunction, MapSnapshot, MapSources, TableFile } from '../../../script/code-quality/architecture/types.ts';
import { completeSourceEvidence } from '../../support/fixtures/ast-metrics-function-identity.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const { correspondenceOf } = await import(new URL('architecture/correspondence.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/correspondence.ts');
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const fn = (name: string, body = name): MapFunction => ({ name, paths: 8, identity: { version: 'typescript-tokens-v1', kind: 'FunctionDeclaration', owner: '', name, start: 0, end: 20, body: hash(body), signature: hash('()') } });
const file = (path: string, functions: readonly MapFunction[]): TableFile => ({ path, functions, sourceEvidence: completeSourceEvidence });
const snapshot = (files: readonly TableFile[]): MapSnapshot => ({ commit: 'a'.repeat(40), date: '2026-10-18T00:00:00Z', files, communities: [], global: { modularity: 0, crossShare: 0, cycles: [], paths: 0, files: files.length, functions: 0 } });
function compare(base: readonly TableFile[], head: readonly TableFile[], changes: readonly FileChange[] = []) {
  const sources: MapSources = { base: snapshot(base), head: snapshot(head), changes, touched: [] };
  return correspondenceOf(sources);
}
function result(value: ReturnType<typeof compare>, entry: MapFunction) {
  const identity = value.head.get(entry);
  assert.ok(identity);
  return identity;
}

test('Given a unique declaration edit, when identities match in one file, then continuity is changed', () => {
  const before = fn('run', 'old'), after = fn('run', 'new');
  const value = result(compare([file('src/a.ts', [before])], [file('src/a.ts', [after])]), after);
  assert.equal(value.classification, 'changed');
  assert.equal(value.base?.fn, before);
});

test('Given a proven rename, when declarations match, then continuity survives the path change', () => {
  const before = fn('run'), after = fn('run');
  const value = compare([file('src/a.ts', [before])], [file('src/b.ts', [after])], [{ status: 'R', oldPath: 'src/a.ts', path: 'src/b.ts' }]);
  assert.equal(result(value, after).classification, 'unchanged');
});

test('Given a unique unchanged body and signature, when a function moves and renames, then it retains continuity', () => {
  const before = fn('old', 'return 1'), after = fn('new', 'return 1');
  assert.equal(result(compare([file('src/a.ts', [before])], [file('src/b.ts', [after])]), after).base?.fn, before);
});

for (const scenario of ['unrelated', 'recursive rename', 'copy', 'duplicate body', 'legacy', 'extraction']) {
  test(`Given ${scenario}, when move evidence is insufficient, then identity is unknown`, () => {
    const before = scenario === 'legacy' ? { name: 'run', paths: 8 } : fn('run', 'run()');
    const after = scenario === 'legacy' ? { name: 'run', paths: 8 } : fn(scenario === 'recursive rename' ? 'renamed' : 'run', scenario === 'copy' || scenario === 'duplicate body' ? 'run()' : 'different()');
    const base = [file('src/a.ts', [before])];
    const head = [file('src/b.ts', [after])];
    if (scenario === 'copy') head.push(file('src/a.ts', [before]));
    if (scenario === 'duplicate body') base.push(file('src/c.ts', [fn('other', 'run()')]));
    assert.equal(result(compare(base, head), after).classification, 'unknown');
  });
}

test('Given a complete base with no unresolved predecessor, when a distinct declaration is added, then it is new', () => {
  const kept = fn('kept'), added = fn('added');
  assert.equal(result(compare([file('src/a.ts', [kept])], [file('src/a.ts', [kept, added])]), added).classification, 'new');
});

test('Given a legacy base without complete source evidence, when a declaration appears, then absence is unproven', () => {
  const added = fn('added');
  assert.equal(result(compare([{ path: 'src/a.ts', functions: [] }], [file('src/a.ts', [added])]), added).classification, 'unknown');
});

test('Given a declaration signature edit, when its binding is unique, then the function is changed', () => {
  const before = fn('run');
  assert.ok(before.identity);
  const after = { ...before, identity: { ...before.identity, signature: hash('(number)') } };
  assert.equal(result(compare([file('src/a.ts', [before])], [file('src/a.ts', [after])]), after).classification, 'changed');
});

test('Given duplicate declarations with distinct bodies, when one body survives, then the duplicate identity stays unknown', () => {
  const first = fn('run', 'first'), second = fn('run', 'second'), after = fn('run', 'first');
  assert.equal(result(compare([file('src/a.ts', [first, second])], [file('src/a.ts', [after])]), after).classification, 'unknown');
});

test('Given an anonymous source function, when a matching body appears elsewhere, then its unstable declaration stays unknown', () => {
  const before = fn('(anonymous)', 'same'), after = fn('(anonymous)', 'same');
  assert.equal(result(compare([file('src/a.ts', [before])], [file('src/b.ts', [after])]), after).classification, 'unknown');
});

const { complexityTableOf } = await import(new URL('architecture/table.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/table.ts');
const { matchingOf } = await import(new URL('architecture/match.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/match.ts');
const { architectureMapOf } = await import(new URL('architecture/map.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/map.ts');
const community = (id: string, members: readonly string[]) => ({ id, label: id, members, files: members.length, loc: 20, paths: 8, edges: [] });

test('Given a file rename and only its old path touched, when the table renders, then one new-path row compares old measurements', () => {
  const before = { ...file('src/a.ts', []), maintainability: 80, paths: 8 }, after = { ...before, path: 'src/b.ts' };
  const sources: MapSources = { base: snapshot([before]), head: snapshot([after]), touched: ['src/a.ts'], changes: [{ status: 'R', oldPath: before.path, path: after.path }] };
  const rows = complexityTableOf(sources, undefined).filter((line) => line.startsWith('| src/'));
  assert.deepEqual(rows, ['| src/b.ts (renamed from src/a.ts) | 80.0 → 80.0 | 8 → 8 | |']);
});

test('Given a rename out of src, when the table renders, then the old source row is gone', () => {
  const before = { ...file('src/a.ts', []), maintainability: 80, paths: 8 };
  const sources: MapSources = { base: snapshot([before]), head: snapshot([]), touched: ['src/a.ts', 'test/a.ts'], changes: [{ status: 'R', oldPath: before.path, path: 'test/a.ts' }] };
  assert.ok(complexityTableOf(sources, undefined).includes('| src/a.ts | 80.0 → gone | 8 → gone | gone |'));
});

test('Given a pure rename, when communities match, then their old and new member paths retain one community', () => {
  const before = community('old', ['src/a.ts']), after = community('new', ['src/b.ts']);
  const changes: FileChange[] = [{ status: 'R', oldPath: 'src/a.ts', path: 'src/b.ts' }];
  assert.equal(matchingOf([before], [after], changes).baseOf.get('new'), before);
  assert.equal(matchingOf([before], [after]).baseOf.size, 0);
});

test('Given a deleted member of a kept community, when nodes render, then the surviving community is touched', () => {
  const base = { ...snapshot([]), communities: [community('old', ['src/a.ts', 'src/kept.ts'])] };
  const head = { ...snapshot([]), communities: [community('new', ['src/kept.ts'])] };
  const map = architectureMapOf({ base, head, touched: ['src/a.ts'] }, undefined);
  assert.equal(map.nodes.length, 1);
  assert.equal(map.nodes[0].status, 'kept');
  assert.equal(map.nodes[0].touched, true);
});

const { crapDeltaOf } = await import(new URL('architecture/crap-delta.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/crap-delta.ts');

test('Given a unique unchanged function moved to an untracked path and renamed, when risk is compared, then its base share follows it without a false addition', () => {
  const before = fn('old', 'return value'), after = fn('renamed', 'return value');
  const sources: MapSources = { base: snapshot([file('src/old.ts', [before])]), head: snapshot([file('src/new.ts', [after])]), touched: ['src/old.ts', 'src/new.ts'], changes: [{ status: 'D', path: 'src/old.ts' }, { status: 'A', path: 'src/new.ts' }], coverage: { files: [{ path: 'src/new.ts', functions: [{ name: 'renamed', coveredShare: 0 }] }] } };
  const delta = crapDeltaOf(sources);
  const measured = delta?.head.get('src/new.ts')?.functions[0];
  assert.equal(measured?.base, 72);
  assert.equal(measured?.crap, 72);
  assert.equal(measured?.addedOrWorse, false);
  assert.equal(delta?.base.get('src/old.ts')?.unmatched, 0);
});
