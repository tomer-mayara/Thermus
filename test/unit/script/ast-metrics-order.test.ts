import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { MapNode } from '../../../script/code-quality/architecture/types.ts';
import type { CommunityMap } from '../../../script/code-quality/snapshot/map.ts';
import type { MergedFunction, MergedScript } from '../../../script/code-quality/coverage/merge.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const scriptFolder = pathToFileURL(astMetricsArchitectureScript);
const { textOrder } = await import(new URL('shared/order.ts', scriptFolder).href) as typeof import('../../../script/code-quality/shared/order.ts');
const { byLabel, byLabels, riskRanksOf } = await import(new URL('architecture/order.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/order.ts');
const { sourceFilesOf } = await import(new URL('snapshot/input.ts', scriptFolder).href) as typeof import('../../../script/code-quality/snapshot/input.ts');
const { snapshotCommunitiesOf, labelsOf } = await import(new URL('snapshot/communities.ts', scriptFolder).href) as typeof import('../../../script/code-quality/snapshot/communities.ts');
const { writeCoverageReport } = await import(new URL('coverage/report.ts', scriptFolder).href) as typeof import('../../../script/code-quality/coverage/report.ts');

function node(label: string): MapNode {
  return { label, status: 'kept', touched: false, numbers: { files: 0, paths: 0 } };
}

test('Given equal labels and risks, when map items are ordered, then exact ties compare equal and tied risks use UTF-16 paths', () => {
  const a = node('same');
  const b = node('same');
  const edge = { from: a, to: b, status: 'kept' as const, references: 1, change: 0, inCycle: false };
  assert.equal(textOrder('same', 'same'), 0);
  assert.equal(byLabel(a, b), 0);
  assert.equal(byLabels(edge, { ...edge, from: b, to: a }), 0);
  assert.deepEqual(['é', 'a', 'Z', 'a'].sort(textOrder), ['Z', 'a', 'a', 'é']);
  assert.deepEqual([...riskRanksOf([{ path: 'src/a.ts', risk: 2 }, { path: 'src/Z.ts', risk: 2 }])], [['src/Z.ts', 1], ['src/a.ts', 2]]);
});

test('Given duplicate file paths, when measurements are sorted, then tied entries retain their input order', () => {
  const concernedFiles = ['é', 'a', 'Z', 'a'].map((name, loc) => ({ path: `/repo/src/${name}.ts`, volume: { loc } }));
  const files = sourceFilesOf(JSON.stringify({ concernedFiles }), '/repo');
  assert.deepEqual(files.map(({ path, loc }) => [path, loc]), [['src/Z.ts', 2], ['src/a.ts', 1], ['src/a.ts', 3], ['src/é.ts', 0]]);
});

test('Given equal community labels and target labels, when a snapshot is made, then tied communities and edges retain their input order', () => {
  const communities = ['second', 'first'].map((id) => ({ id, hubs: [], members: [], namespaces: [{ namespace: 'src/Z', count: 1 }, { namespace: 'src/a', count: 1 }, { namespace: 'src/Z', count: 1 }], references: { internal: 0, inbound: 0, outbound: 0 } }));
  const map: CommunityMap = {
    communities, labels: new Map(communities.map(({ id }) => [id, 'same'])), cycles: [], communityOf: () => null,
    edges: ['second', 'first'].map((to, references) => ({ from: 'second', to, references, inCycle: false })),
  };
  const result = snapshotCommunitiesOf(map, []);
  assert.deepEqual(result.map(({ id }) => id), ['second', 'first']);
  assert.deepEqual(result[0].edges.map(({ to }) => to), ['second', 'first']);
  assert.deepEqual([...labelsOf(communities).values()], ['Z (second)', 'Z (first)']);
});

function coverageFunction(name: string, called: number): MergedFunction {
  return { name, called, start: 0, end: 1, covered: new Uint8Array([1]), ownCharacters: 1 };
}

test('Given equal function ranges and locale-equal names, when coverage is written, then locale ordering preserves the input order of equal names', (t) => {
  const functions = ['Z', 'é', 'e\u0301', 'a'].map(coverageFunction);
  const script: MergedScript = {
    path: 'src/a.ts', representation: 'source-typescript', contentIdentity: 'a'.repeat(64), length: 1,
    functions: new Map(functions.map((fn) => [fn.name, fn])),
  };
  const origin = { commit: null, provenance: { status: 'unverified' as const, reason: 'Synthetic unit data.' } };
  const report = writeCoverageReport(`${dataDirectory(t)}/coverage.json`, origin, { processes: 1, scripts: new Map([['src/a.ts', script]]) });
  assert.deepEqual(report.files[0].functions.map(({ name, called }) => [name, called]), [['a', 3], ['é', 1], ['e\u0301', 2], ['Z', 0]]);
});
