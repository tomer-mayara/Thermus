import { readFileSync } from 'node:fs';
import { validateChanges, type FileChange } from '../delta/changes.ts';
import { changeOf, checkSides } from './changes-schema.ts';
import * as json from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import type { MapSnapshot } from './types.ts';

// Offline evidence belongs to both captured contents, including uncommitted edits.
export function changesInFile(path: string, base: MapSnapshot, head: MapSnapshot): FileChange[] {
  const fields = json.objectOf(json.jsonOf(fileText(path)));
  if (fields.version !== 1 || !Array.isArray(fields.files)) invalid(path);
  checkIdentity(fields.base, base, 'base');
  checkIdentity(fields.head, head, 'head');
  const changes = validateChanges(json.arrayOf(fields.files).map((entry) => changeOf(entry, path)));
  const before = new Set(base.files.map((file) => file.path));
  const after = new Set(head.files.map((file) => file.path));
  for (const change of changes) checkSides(change, before, after);
  return changes;
}

function fileText(path: string): string {
  try { return readFileSync(path, 'utf8'); }
  catch { throw new CommandError(`Cannot read the changes file ${path}.`); }
}

function invalid(path: string): never {
  throw new CommandError(`The file ${path} is not valid change metadata of version 1.`);
}

function checkIdentity(value: unknown, snapshot: MapSnapshot, side: string): void {
  const fields = json.objectOf(value);
  if (!snapshot.provenance || fields.commit !== snapshot.commit || fields.sourceFingerprint !== snapshot.provenance.sourceFingerprint) {
    throw new CommandError(`The changes ${side} identity does not match the supplied snapshot commit and source fingerprint.`);
  }
}
