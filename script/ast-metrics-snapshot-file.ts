import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Snapshot } from './ast-metrics-snapshot-types.ts';

// The file is complete or absent: the text goes to a temporary file next to it, and a rename replaces the file in one
// step.
export function writeSnapshotFile(path: string, snapshot: Snapshot): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
