import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';

// Snapshot files in the shape that script/code-quality/ast-metrics-snapshot.ts writes, for the architecture command with --head and
// --base-snapshot. The base is a small src/ in four communities, after the real one: src depends on auth and
// hosted-admin, both depend on the shared kernel, and there is no cycle. The numbers of the files of each community give
// the numbers of that community. Three files are in no community, so that a change of them does not change the map: one
// of them is a file of types, without a maintainability index. A case edits a copy of the base. The files also hold the
// fields that the command does not read, such as the hub and the lines of each file, so that they are complete
// snapshots.

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

export interface FileShape {
  readonly path: string;
  readonly community: string | null;
  readonly maintainability?: number;
  readonly paths: number;
  readonly loc: number;
  readonly risk?: number;
  readonly functions: readonly object[];
}

export interface SnapshotShape {
  readonly version: 1;
  readonly commit: string;
  readonly date: string;
  readonly global: GlobalShape & { readonly maintainability?: number; readonly paths: number; readonly files: number; readonly functions: number };
  readonly communities: readonly CommunityShape[];
  readonly files: readonly FileShape[];
}

// The legend under each graph without bands.
export const legend = 'Legend: thick border = a community this pull request touched; `· new` and `· gone` = a community or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base.';

// Without a coverage report, this line follows the summary line.
export const bandsNeedTheCoverage = 'Bands need the coverage: run pnpm exec node script/code-quality/ast-metrics-coverage.ts first.';

export const complexityHeading = '## Complexity of the changed files';
export const tableHead = ['| File | Maintainability | Decision paths | Risk rank |', '| --- | --- | --- | --- |'];
export const noProductionFile = [complexityHeading, '', 'No production file changed.'];

// The trend section after the complexity section. Two snapshot files without --trend-store have no store, so the
// section has one line.
export const trendHeading = '## Trend of src/ on main';
export const noTrend = [trendHeading, '', 'No trend store.'];

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

interface FileParts {
  readonly maintainability?: number;
  readonly paths: number;
  readonly risk?: number;
}

// Each file has 100 lines and no functions.
export function file(path: string, community: string | null, parts: FileParts): FileShape {
  return { path, community, maintainability: parts.maintainability, paths: parts.paths, loc: 100, risk: parts.risk, functions: [] };
}

// The risk ranks of the base: application 1, session 2, access-context 3, accounts 4, tokens 5, routes 6, roles 7, and
// gone 8. The other files have no risk score.
const baseFiles = [
  file('src/application.ts', '2', { maintainability: 52, paths: 30, risk: 0.9 }),
  file('src/auth/access-context.ts', null, { maintainability: 72, paths: 12, risk: 0.6 }),
  file('src/auth/roles.ts', '1', { maintainability: 64, paths: 20, risk: 0.2 }),
  file('src/auth/session.ts', '1', { maintainability: 50, paths: 40, risk: 0.8 }),
  file('src/auth/tokens.ts', '1', { maintainability: 62.4, paths: 30, risk: 0.4 }),
  file('src/auth/users.ts', '1', { maintainability: 58, paths: 20 }),
  file('src/hosted-admin/accounts.ts', '3', { maintainability: 63.2, paths: 45, risk: 0.5 }),
  file('src/hosted-admin/routes.ts', '3', { maintainability: 70, paths: 30, risk: 0.3 }),
  file('src/index.ts', '2', { maintainability: 60, paths: 10 }),
  file('src/kernel/ids.ts', 'shared', { maintainability: 77, paths: 18 }),
  file('src/old/gone.ts', null, { maintainability: 55, paths: 20, risk: 0.1 }),
  file('src/user-portal/env.d.ts', null, { paths: 0 }),
];

// The header of the output names the first eight characters of the commit.
export const baseSnapshot: SnapshotShape = {
  version: 1,
  commit: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  date: '2026-10-18T09:00:00+02:00',
  global: { modularity: 0.52, crossShare: 0.26, cycles: [], maintainability: 62.1, paths: 275, files: 12, functions: 0 },
  communities: [
    community('1', 'auth', { members: ['src/auth/roles.ts', 'src/auth/session.ts', 'src/auth/tokens.ts', 'src/auth/users.ts'], maintainability: 58.6, paths: 110, edges: [edge('3', 10), edge('shared', 2)] }),
    community('3', 'hosted-admin', { members: ['src/hosted-admin/accounts.ts', 'src/hosted-admin/routes.ts'], maintainability: 66.6, paths: 75, edges: [edge('shared', 4)] }),
    community('shared', 'shared kernel', { members: ['src/kernel/ids.ts'], maintainability: 77, paths: 18 }),
    community('2', 'src', { members: ['src/application.ts', 'src/index.ts'], maintainability: 56, paths: 40, edges: [edge('1', 20), edge('3', 5)] }),
  ],
  files: baseFiles,
};

type Changes<T> = Readonly<Record<string, Partial<T> | null>>;

export interface SnapshotEdits {
  readonly global?: Partial<SnapshotShape['global']>;
  // The changed fields of each community, by id. null removes the community.
  readonly communities?: Changes<CommunityShape>;
  readonly added?: readonly CommunityShape[];
  // The changed fields of each file, by path. null removes the file.
  readonly files?: Changes<FileShape>;
  readonly addedFiles?: readonly FileShape[];
}

// A copy of the snapshot with the edits. The communities stay sorted by label and the files by path, as in a real
// snapshot.
export function edited(snapshot: SnapshotShape, edits: SnapshotEdits): SnapshotShape {
  const communities = [...changed(snapshot.communities, (entry) => edits.communities?.[entry.id]), ...(edits.added ?? [])];
  const files = [...changed(snapshot.files, (entry) => edits.files?.[entry.path]), ...(edits.addedFiles ?? [])];
  return {
    ...snapshot,
    global: { ...snapshot.global, ...edits.global },
    communities: communities.sort((first, second) => (first.label < second.label ? -1 : 1)),
    files: files.sort((first, second) => (first.path < second.path ? -1 : 1)),
  };
}

function changed<T>(entries: readonly T[], changeOf: (entry: T) => Partial<T> | null | undefined): T[] {
  return entries.flatMap((entry) => {
    const change = changeOf(entry);
    return change === null ? [] : [{ ...entry, ...change }];
  });
}

// Writes the two snapshots to files in a new folder and gives the arguments that name them.
export function snapshotArguments(t: TestContext, base: SnapshotShape, head: SnapshotShape): string[] {
  const folder = dataDirectory(t);
  const files = { base: join(folder, 'snapshot-base.json'), head: join(folder, 'snapshot.json') };
  writeFileSync(files.base, `${JSON.stringify(base, null, 2)}\n`);
  writeFileSync(files.head, `${JSON.stringify(head, null, 2)}\n`);
  return ['--head', files.head, '--base-snapshot', files.base];
}
