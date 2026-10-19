import type { MapSources } from '../../../script/code-quality/architecture/types.ts';
import type { FileChange } from '../../../script/code-quality/delta/changes.ts';
import type { DependencyPair } from '../../../script/code-quality/dependencies/types.ts';
import type { Snapshot } from '../../../script/code-quality/snapshot/types.ts';

type Groups = Readonly<Record<string, readonly string[]>>;
const identity = { sourceFingerprint: 'a'.repeat(64), inputsFingerprint: 'b'.repeat(64), runtime: 'node:test', compiler: 'typescript:test', measurementVersion: 'own-characters-1', suite: 'unit' } as const;

export function dependencyPairOf(from: string, to: string): DependencyPair {
  return { from, to, kinds: ['static'] };
}

export function evidenceSnapshotOf(groups: Groups, pairs: readonly DependencyPair[]): Snapshot {
  const communities = Object.entries(groups).map(([label, members]) => {
    const targets = new Set(pairs.filter((pair) => members.includes(pair.from)).flatMap((pair) => Object.entries(groups)
      .filter(([target, paths]) => target !== label && paths.includes(pair.to)).map(([target]) => target)));
    return {
      id: label, label, hub: members[0], members, files: members.length, loc: members.length, paths: 1,
      references: { internal: 0, inbound: 0, outbound: 0 },
      edges: [...targets].map((to) => ({ to, references: 17, inCycle: false })),
    };
  });
  const files = Object.entries(groups).flatMap(([label, paths]) => paths.map((path) => ({ path, community: label, loc: 1, paths: 1, functions: [] })));
  return {
    version: 1, commit: 'c0ffee00c0ffee00', date: '2026-10-18T00:00:00-06:00', provenance: identity,
    global: { modularity: 0.5, crossShare: 0.25, cycles: [], paths: files.length, files: files.length, functions: 0 },
    files, communities, dependencies: { version: 1, pairs, issues: [] },
  };
}

export function regroupedSourcesOf(): MapSources {
  const pairs = [dependencyPairOf('src/a/client.ts', 'src/b/moved.ts')];
  const base = evidenceSnapshotOf({ alpha: ['src/a/client.ts', 'src/a/one.ts', 'src/a/two.ts'], beta: ['src/b/moved.ts', 'src/b/one.ts', 'src/b/two.ts'], gamma: ['src/c/one.ts', 'src/c/two.ts', 'src/c/three.ts'] }, pairs);
  const head = evidenceSnapshotOf({ alpha: ['src/a/client.ts', 'src/a/one.ts', 'src/a/two.ts'], beta: ['src/b/one.ts', 'src/b/two.ts'], gamma: ['src/b/moved.ts', 'src/c/one.ts', 'src/c/two.ts', 'src/c/three.ts'] }, pairs);
  return { base, head, touched: [] };
}

export function changedImportSourcesOf(count = 1): MapSources {
  const from = 'src/a/client.ts';
  const targets = Array.from({ length: count }, (_, index) => `src/b/target-${String(index).padStart(2, '0')}.ts`);
  const groups = { alpha: [from], beta: targets };
  return { base: evidenceSnapshotOf(groups, []), head: evidenceSnapshotOf(groups, targets.map((to) => dependencyPairOf(from, to))), touched: [] };
}

export function renamedSourcesOf(changes: readonly FileChange[]): MapSources {
  const base = evidenceSnapshotOf({ alpha: ['src/old/client.ts'], beta: ['src/old/target.ts'] }, [dependencyPairOf('src/old/client.ts', 'src/old/target.ts')]);
  const head = evidenceSnapshotOf({ renamedAlpha: ['src/new/client.ts'], renamedBeta: ['src/new/target.ts'] }, [dependencyPairOf('src/new/client.ts', 'src/new/target.ts')]);
  return { base, head, touched: [], changes };
}

export const provenMoves = [
  { status: 'R', oldPath: 'src/old/client.ts', path: 'src/new/client.ts' },
  { status: 'R', oldPath: 'src/old/target.ts', path: 'src/new/target.ts' },
] as const;

export function movedAndRegroupedSourcesOf(): MapSources {
  const sources = regroupedSourcesOf();
  const changes = [
    { status: 'R', oldPath: 'src/a/client.ts', path: 'src/new/client.ts' },
    { status: 'R', oldPath: 'src/b/moved.ts', path: 'src/new/moved.ts' },
  ] as const;
  const after = new Map<string, string>(changes.map((change) => [change.oldPath, change.path]));
  const groups = Object.fromEntries(sources.head.communities.map((community) => [community.label, community.members.map((path) => after.get(path) ?? path)]));
  const head = evidenceSnapshotOf(groups, [dependencyPairOf('src/new/client.ts', 'src/new/moved.ts')]);
  return { ...sources, head, changes };
}
