import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';

// Snapshot files in the shape that script/ast-metrics-snapshot.ts writes, for the architecture command with --head and
// --base-snapshot. The base is a small src/ in four communities, after the real one: src depends on auth and
// hosted-admin, both depend on the shared kernel, and there is no cycle. A case edits a copy of it. The files also hold
// the fields that the command does not read, such as the hub and the lines, so that they are complete snapshots.

export interface EdgeShape {
  readonly to: string;
  readonly references: number;
  readonly inCycle: boolean;
}

export interface CommunityShape {
  readonly id: string;
  readonly label: string;
  readonly hub: string;
  readonly members: readonly string[];
  readonly files: number;
  readonly loc: number;
  readonly maintainability?: number;
  readonly paths: number;
  readonly references: { readonly internal: number; readonly inbound: number; readonly outbound: number };
  readonly edges: readonly EdgeShape[];
}

interface GlobalShape {
  readonly modularity: number;
  readonly crossShare: number;
  readonly cycles: readonly (readonly string[])[];
}

export interface SnapshotShape {
  readonly version: 1;
  readonly commit: string;
  readonly date: string;
  readonly global: GlobalShape & { readonly maintainability?: number; readonly paths: number; readonly files: number; readonly functions: number };
  readonly communities: readonly CommunityShape[];
  readonly files: readonly object[];
}

// The legend under each graph.
export const legend = 'Legend: thick border = a community this pull request touched; `· new` and `· gone` = a community or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base.';

export function edge(to: string, references: number, inCycle = false): EdgeShape {
  return { to, references, inCycle };
}

interface CommunityParts {
  readonly members: readonly string[];
  readonly maintainability?: number;
  readonly paths: number;
  readonly edges?: readonly EdgeShape[];
}

// The hub is the first member without its extension, and each file has 100 lines.
export function community(id: string, label: string, parts: CommunityParts): CommunityShape {
  return {
    id, label, hub: parts.members[0].replace(/\.ts$/, ''), members: parts.members, files: parts.members.length, loc: 100 * parts.members.length,
    maintainability: parts.maintainability, paths: parts.paths, references: { internal: 3, inbound: 2, outbound: 2 }, edges: parts.edges ?? [],
  };
}

// The header of the output names the first eight characters of the commit.
export const baseSnapshot: SnapshotShape = {
  version: 1,
  commit: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  date: '2026-10-18T09:00:00+02:00',
  global: { modularity: 0.52, crossShare: 0.26, cycles: [], maintainability: 60.1, paths: 243, files: 9, functions: 40 },
  communities: [
    community('1', 'auth', { members: ['src/auth/roles.ts', 'src/auth/session.ts', 'src/auth/tokens.ts', 'src/auth/users.ts'], maintainability: 58.6, paths: 110, edges: [edge('3', 10), edge('shared', 2)] }),
    community('3', 'hosted-admin', { members: ['src/hosted-admin/accounts.ts', 'src/hosted-admin/routes.ts'], maintainability: 66.6, paths: 75, edges: [edge('shared', 4)] }),
    community('shared', 'shared kernel', { members: ['src/kernel/ids.ts'], maintainability: 77, paths: 18 }),
    community('2', 'src', { members: ['src/application.ts', 'src/index.ts'], maintainability: 56, paths: 40, edges: [edge('1', 20), edge('3', 5)] }),
  ],
  files: [],
};

export interface SnapshotEdits {
  readonly global?: Partial<GlobalShape>;
  // The changed fields of each community, by id. null removes the community.
  readonly communities?: Readonly<Record<string, Partial<CommunityShape> | null>>;
  readonly added?: readonly CommunityShape[];
}

// A copy of the snapshot with the edits. The communities stay sorted by label, as in a real snapshot.
export function edited(snapshot: SnapshotShape, edits: SnapshotEdits): SnapshotShape {
  const kept = snapshot.communities.flatMap((entry) => {
    const change = edits.communities?.[entry.id];
    return change === null ? [] : [{ ...entry, ...change }];
  });
  const communities = [...kept, ...(edits.added ?? [])].sort((first, second) => (first.label < second.label ? -1 : 1));
  return { ...snapshot, global: { ...snapshot.global, ...edits.global }, communities };
}

// Writes the two snapshots to files in a new folder and gives the arguments that name them.
export function snapshotArguments(t: TestContext, base: SnapshotShape, head: SnapshotShape): string[] {
  const folder = dataDirectory(t);
  const files = { base: join(folder, 'snapshot-base.json'), head: join(folder, 'snapshot.json') };
  writeFileSync(files.base, `${JSON.stringify(base, null, 2)}\n`);
  writeFileSync(files.head, `${JSON.stringify(head, null, 2)}\n`);
  return ['--head', files.head, '--base-snapshot', files.base];
}
