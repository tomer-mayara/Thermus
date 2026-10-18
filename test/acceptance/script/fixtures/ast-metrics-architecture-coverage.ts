import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';
import { baseSnapshot, edited, legend, type SnapshotShape } from './ast-metrics-architecture-snapshots.ts';

// The functions of the base snapshot of ast-metrics-architecture-snapshots.ts, and a coverage report of the unit suite
// in the shape that script/ast-metrics-coverage.ts writes. With the covered shares of the report, the base has four
// functions with CRAP 30 or more: issueToken of auth (72.0), listAccounts (72.8) and route (68.0) of hosted-admin, and
// createApplication of src (42.0), whose file the report does not have, so that it counts as uncovered. In
// src/auth/session.ts, refresh has two entries in the report and the third function is anonymous, so neither gets a
// CRAP. The shared kernel has no function at 30 or more. A case edits a copy of the banded base for its head.

interface FunctionShape {
  readonly name: string;
  readonly paths: number;
  readonly maintainability: number;
  readonly loc: number;
}

export function fn(name: string, paths: number): FunctionShape {
  return { name, paths, maintainability: 70, loc: 10 };
}

export const bandedBase: SnapshotShape = edited(baseSnapshot, {
  files: {
    'src/application.ts': { functions: [fn('createApplication', 6)] },
    'src/auth/access-context.ts': { functions: [fn('createContext', 2)] },
    'src/auth/roles.ts': { functions: [fn('grantRole', 4)] },
    'src/auth/session.ts': { functions: [fn('openSession', 4), fn('(anonymous)', 3), fn('refresh', 30)] },
    'src/auth/tokens.ts': { functions: [fn('issueToken', 8), fn('verifyToken', 7)] },
    'src/auth/users.ts': { functions: [fn('findUser', 3)] },
    'src/hosted-admin/accounts.ts': { functions: [fn('listAccounts', 12), fn('renderAccount', 3)] },
    'src/hosted-admin/routes.ts': { functions: [fn('route', 9)] },
    'src/index.ts': { functions: [fn('main', 2)] },
    'src/kernel/ids.ts': { functions: [fn('newId', 1)] },
  },
});

interface CoverageFunctionShape {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly called: number;
  readonly coveredShare: number;
}

// Each file starts with its module function, which has no name. Each function has 100 characters after the one before.
function coverageFileOf(path: string, shares: readonly (readonly [string, number])[]): { readonly path: string; readonly functions: readonly CoverageFunctionShape[] } {
  const entries = [['(anonymous)', 1] as const, ...shares];
  return { path, functions: entries.map(([name, coveredShare], index) => ({ name, start: index * 100, end: index * 100 + 99, called: coveredShare > 0 ? 1 : 0, coveredShare })) };
}

// exportAccounts is in the report for the head that adds it. src/application.ts is not in the report: no unit test
// loaded it.
export const unitCoverage = {
  version: 1,
  suite: 'unit',
  commit: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
  processes: 3,
  scripts: 9,
  files: [
    coverageFileOf('src/auth/access-context.ts', [['createContext', 1]]),
    coverageFileOf('src/auth/roles.ts', [['grantRole', 1]]),
    coverageFileOf('src/auth/session.ts', [['openSession', 0.5], ['refresh', 0.9], ['refresh', 0.4]]),
    coverageFileOf('src/auth/tokens.ts', [['issueToken', 0], ['verifyToken', 0.5]]),
    coverageFileOf('src/auth/users.ts', [['findUser', 1]]),
    coverageFileOf('src/hosted-admin/accounts.ts', [['listAccounts', 0.25], ['renderAccount', 1], ['exportAccounts', 0]]),
    coverageFileOf('src/hosted-admin/routes.ts', [['route', 0.1]]),
    coverageFileOf('src/index.ts', [['main', 0.5]]),
    coverageFileOf('src/kernel/ids.ts', [['newId', 1]]),
  ],
};

// Writes the report to a file in a new folder and gives the arguments that name it.
export function coverageArguments(t: TestContext, report: object = unitCoverage): string[] {
  const file = join(dataDirectory(t), 'coverage.json');
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return ['--coverage', file];
}

// The legend under a graph with bands: the legend without bands, with the borders of the bands before the numbers.
export const bandedLegend = legend.replace('numbers =', 'border color = the CRAP band of the community (● good: no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse); numbers =');

export const bandedTableHead = ['| File | Maintainability | Decision paths | CRAP ≥ 30 | Risk rank |', '| --- | --- | --- | --- | --- |'];

export function functionsSection(lines: readonly string[], unmatched: number): string[] {
  return ['### Functions at CRAP 30 or more, added or worse', '', ...(lines.length === 0 ? ['None.'] : lines), '', `Unmatched functions: ${unmatched} (anonymous, duplicate, or not in the coverage).`];
}
