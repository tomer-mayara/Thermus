import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';
import { trendHeading } from './ast-metrics-architecture-snapshots.ts';
import type { GitRepository } from './git-repository.ts';

// The records of a trend store in the shape that the architecture command writes them: one JSON file for each commit of
// main, named by the date of the commit and its first eight characters, with the global numbers of its snapshot and
// the numbers of each community, and nothing for each file. A field without a value, such as the count of the
// functions at CRAP 30 or more without coverage, is absent.

export interface TrendCommunityShape {
  readonly label: string;
  readonly files: number;
  readonly loc: number;
  readonly maintainability?: number;
  readonly paths: number;
  readonly functionsOver30?: number;
}

export interface TrendRecordShape {
  readonly version: 1;
  readonly commit: string;
  readonly date: string;
  readonly modularity: number;
  readonly crossShare: number;
  readonly cycles: number;
  readonly maintainability?: number;
  readonly paths: number;
  readonly files: number;
  readonly functions: number;
  readonly functionsOver30?: number;
  readonly communities: readonly TrendCommunityShape[];
}

export const trendTableHead = [
  '| Commit | PR | Date | Modularity | Cross share | Cycles | Maintainability | Functions ≥ 30 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
];

// The trend section with a store: the heading and the table, whose last row is the head.
export function trendSection(rows: readonly string[]): string[] {
  return [trendHeading, '', ...trendTableHead, ...rows];
}

// The complete output: the output up to the trend section, which ends with a newline, and the trend section.
export function withTrend(markdown: string, rows: readonly string[]): string {
  return `${markdown}\n${[...trendSection(rows), ''].join('\n')}`;
}

// JSON with two spaces and a newline at the end, so that two records diff well.
export function recordText(record: TrendRecordShape): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

// A new, empty folder for the store.
export function emptyStore(t: TestContext): string {
  const folder = join(dataDirectory(t), 'metrics');
  mkdirSync(folder);
  return folder;
}

// Writes each record under its name: the date of the commit as git gives it, in the time zone of the commit, and the
// first eight characters of the commit.
export function writeRecords(folder: string, records: readonly TrendRecordShape[]): void {
  for (const record of records) writeFileSync(join(folder, `${record.date.slice(0, 10)}-${record.commit.slice(0, 8)}.json`), recordText(record));
}

// The first two cells of the row of a commit of a test repository: its first eight characters and its date.
export function commitCells(repository: GitRepository, ref: string): string {
  const commit = repository.git('rev-parse', ref).trim();
  const date = repository.git('show', '-s', '--format=%cI', ref).trim();
  return `| ${commit.slice(0, 8)} | ${date.slice(0, 10)} |`;
}
