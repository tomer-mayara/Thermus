import assert from 'node:assert/strict';
import { posix } from 'node:path';
import type { Snapshot } from '../../../../script/code-quality/snapshot/types.ts';
import { noProductionFile, trendHeading } from './ast-metrics-architecture-snapshots.ts';

export function assertSnapshotOfHead(snapshot: Snapshot, commit: string): void {
  assert.equal(snapshot.tool, '0.43.1');
  assert.equal(snapshot.commit, commit);
  assert.ok(snapshot.global.files > 0, `${snapshot.global.files} files`);
  assert.ok(snapshot.global.functions > 0, `${snapshot.global.functions} functions`);
  assertSourceCommunities(snapshot);
  assertDependenciesOfSource(snapshot);
}

function assertSourceCommunities(snapshot: Snapshot): void {
  const labels = snapshot.communities.map(({ label }) => label);
  assert.ok(labels.includes('shared kernel'), labels.join(', '));
  assert.equal(new Set(labels).size, labels.length, labels.join(', '));
  assert.ok(Array.isArray(snapshot.global.cycles));
  for (const cycle of snapshot.global.cycles) {
    assert.ok(Array.isArray(cycle), JSON.stringify(cycle));
    assert.deepEqual(cycle.filter((label) => !labels.includes(label)), [], JSON.stringify(cycle));
  }
  assert.deepEqual(snapshot.communities.flatMap(({ members }) => members).filter((member) => !member.startsWith('src/')), []);
  assert.deepEqual(snapshot.files.filter(({ path }) => !path.startsWith('src/')), []);
  const ids = new Set(snapshot.communities.map(({ id }) => id));
  assert.deepEqual(snapshot.files.filter(({ community }) => community !== null && !ids.has(community)), []);
}

function assertDependenciesOfSource(snapshot: Snapshot): void {
  assert.ok(snapshot.dependencies, 'The snapshot must retain source dependency evidence.');
  assert.equal(snapshot.dependencies.version, 1);
  const paths = new Set(snapshot.files.map(({ path }) => path));
  const keys = snapshot.dependencies.pairs.map(({ from, to }) => JSON.stringify([from, to]));
  assert.equal(new Set(keys).size, keys.length, 'Dependency pairs must be unique.');
  for (const { from, to, kinds } of snapshot.dependencies.pairs) {
    assert.ok(paths.has(from), from);
    assert.ok(paths.has(to), to);
    assert.ok(from.startsWith('src/') && to.startsWith('src/'), `${from} → ${to}`);
    assert.ok(!from.includes('\\') && !to.includes('\\'), `${from} → ${to}`);
    assert.equal(posix.normalize(from), from);
    assert.equal(posix.normalize(to), to);
    assert.ok(kinds.length > 0, `${from} → ${to}`);
    assert.equal(new Set(kinds).size, kinds.length, `${from} → ${to}`);
    assert.deepEqual(kinds.filter((kind) => !['static', 'type', 're-export', 'side-effect', 'dynamic'].includes(kind)), []);
  }
  assert.ok(snapshot.dependencies.pairs.some(({ from, to, kinds }) =>
    from === 'src/application.ts' && to === 'src/fetch-tool.ts' && kinds.includes('dynamic')),
  'The literal dynamic import in application.ts must be retained.');
  for (const issue of snapshot.dependencies.issues) assert.ok(paths.has(issue.path), issue.path);
}

export function assertArchitectureOfHead(output: string, commit: string, sourceInventory: string): void {
  const [header, , summary] = output.split('\n');
  assert.equal(header, `## Architecture of src/: base ${commit.slice(0, 8)} → head`);
  const sides = [...summary.matchAll(/(\S+) → (\S+)/g)].map(([, before, after]) => [before, after]);
  assert.equal(sides.length, 4, summary);
  assert.deepEqual(sides.filter(([before, after]) => before !== after), [], summary);
  assertCommunityMap(output, summary);
  assertComponentMap(output, sourceInventory);
  assertUnchangedComplexity(output);
}

function assertCommunityMap(output: string, summary: string): void {
  const notice = 'Coverage was skipped with --no-coverage: the bands are withheld.';
  assert.ok(output.includes([summary, '', notice, '', 'The map did not change.', '', '```mermaid', 'flowchart LR'].join('\n')), output);
  const componentStart = output.indexOf('## Components of src/');
  assert.ok(componentStart > 0, output);
  const nodes = output.slice(0, componentStart).split('\n').filter((line) => /^ {2}c_\w+\["/.test(line));
  const communityCount = summary.match(/communities (\d+) → (\d+)/);
  assert.ok(communityCount, summary);
  assert.equal(nodes.length, Number(communityCount[2]), output);
  assert.match(output, /\nLegend: /u);
}

function assertComponentMap(output: string, sourceInventory: string): void {
  const componentSection = output.slice(output.indexOf('## Components of src/'), output.indexOf(noProductionFile[0]));
  const componentNames = [...componentSection.matchAll(/^ {2}\w+\["([^<"]+)<br\/>/gmu)].map(([, name]) => name).sort();
  const sourcePaths = sourceInventory.trim().split('\n').filter((path) => /\.tsx?$/u.test(path));
  const expectedNames = [...new Set(sourcePaths.map(componentNameOf))].sort();
  assert.deepEqual(componentNames, expectedNames, componentSection);
  assert.ok(componentSection.includes('```mermaid\nflowchart LR'), componentSection);
  assert.match(componentSection, /\nLegend: /u);
}

function componentNameOf(path: string): string {
  const parts = path.split('/');
  return parts.length > 2 ? parts[1] : 'src';
}

function assertUnchangedComplexity(output: string): void {
  const complexity = output.slice(output.indexOf(noProductionFile[0]), output.indexOf(trendHeading)).trimEnd().split('\n');
  assert.deepEqual(complexity.slice(0, noProductionFile.length), noProductionFile);
  const identityNotices = complexity.slice(noProductionFile.length).filter((line) => line !== '');
  assert.ok(identityNotices.length <= 1, output);
  for (const identityNotice of identityNotices) assert.match(identityNotice, /^Unknown function identity: [1-9]\d* \(no proven declaration or unique unchanged body\/signature correspondence\)\.$/u);
}
