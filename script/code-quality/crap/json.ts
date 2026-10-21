import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CommandError } from '../shared/repository.ts';
import { sourceIdentityOf } from './classification.ts';
import type { GoalFunction } from './types.ts';

// A value that the table shows as unknown is absent, so that no reader takes a bound for a measured value.
interface CrapJsonRow {
  readonly file: string;
  readonly function: string;
  readonly change: GoalFunction['change'];
  readonly paths: number;
  readonly share?: number;
  readonly crap?: number;
  readonly identity?: string;
}

export function crapJsonOf(commits: { readonly base: string; readonly head: string }, rows: readonly GoalFunction[]): string {
  return `${JSON.stringify({ version: 1, base: commits.base, head: commits.head, rows: rows.map(jsonRowOf) }, null, 2)}\n`;
}

function jsonRowOf(entry: GoalFunction): CrapJsonRow {
  const identity = sourceIdentityOf(entry);
  return {
    file: entry.file, function: entry.name, change: entry.change, paths: entry.paths,
    ...(entry.share === undefined ? {} : { share: entry.share, crap: entry.crap }),
    ...(identity === undefined ? {} : { identity }),
  };
}

export function writeCrapJson(file: string, text: string): void {
  const path = resolve(file);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  } catch {
    throw new CommandError(`Cannot write the CRAP rows to ${file}.`);
  }
}
