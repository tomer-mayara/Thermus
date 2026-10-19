import { readFileSync } from 'node:fs';
import { jsonOf, objectOf, type JsonObject } from './json.ts';
import { CommandError } from './repository.ts';

// Each caller checks its own schema. A missing file has a different diagnostic from invalid contents.
export function jsonFieldsInFile(path: string, kind: string): JsonObject {
  let text: string;
  try { text = readFileSync(path, 'utf8'); }
  catch { throw new CommandError(`Cannot read the ${kind} file ${path}.`); }
  return objectOf(jsonOf(text));
}
