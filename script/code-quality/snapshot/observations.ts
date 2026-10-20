import { isJsonObject, jsonOf } from '../shared/json.ts';
import type { JsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';
import type { NativeClassObservation } from './types.ts';

interface SnapshotObservationBinding {
  readonly commit: string;
  readonly tool: string;
}

interface SnapshotObservations extends SnapshotObservationBinding {
  readonly version: 1;
  readonly files: readonly FileObservations[];
}

interface FileObservations {
  readonly path: string;
  readonly maintainabilityRaw?: number;
  readonly classObservations?: readonly NativeClassObservation[];
}

// This projection checks declared bindings and raw fields only. It does not prove
// clean content, authenticity, trusted inputs, or class identity and completeness.
export function snapshotObservationsIn(text: string, expected: SnapshotObservationBinding): SnapshotObservations {
  if (typeof expected.commit !== 'string' || expected.commit.length !== 40 || !/^[a-f0-9]{40}$/u.test(expected.commit)) invalid('expected.commit', 'a full lowercase commit SHA');
  if (typeof expected.tool !== 'string' || expected.tool.trim() === '') invalid('expected.tool', 'a nonempty tool string');
  const fields = objectIn(jsonOf(text), 'snapshot');
  if (fields.version !== 1) invalid('version', '1');
  if (fields.commit !== expected.commit) invalid('commit', 'the expected commit');
  if (fields.tool !== expected.tool) invalid('tool', 'the expected tool');
  if (!Array.isArray(fields.files)) invalid('files', 'an array');
  const paths = new Set<string>();
  const files = fields.files.map((value, index) => fileIn(value, index, paths));
  return { version: 1, commit: expected.commit, tool: expected.tool, files };
}

function fileIn(value: unknown, index: number, paths: Set<string>): FileObservations {
  const field = `files[${index}]`;
  const fields = objectIn(value, field);
  const path = pathIn(fields.path, `${field}.path`);
  if (paths.has(path)) invalid(`${field}.path`, 'a unique source path');
  paths.add(path);
  const maintainabilityRaw = rawIn(fields.maintainabilityRaw, `${path}.maintainabilityRaw`);
  const classes = fields.classObservations;
  if (classes !== undefined && !Array.isArray(classes)) invalid(`${path}.classObservations`, 'an array');
  return {
    path,
    ...(maintainabilityRaw === undefined ? {} : { maintainabilityRaw }),
    ...(classes === undefined ? {} : { classObservations: classes.map((entry, position) => classIn(entry, `${path}.classObservations[${position}]`)) }),
  };
}

function pathIn(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.startsWith('src/') || /[\\\u0000-\u001f\u007f-\u009f]/u.test(value)) invalid(field, 'a canonical src/ path');
  if (value.split('/').some((part) => part === '' || part === '.' || part === '..')) invalid(field, 'a canonical src/ path');
  return value;
}

function classIn(value: unknown, field: string): NativeClassObservation {
  const fields = objectIn(value, field);
  if (typeof fields.name !== 'string') invalid(`${field}.name`, 'a string');
  const maintainabilityRaw = rawIn(fields.maintainabilityRaw, `${field}.maintainabilityRaw`);
  return { name: fields.name, ...(maintainabilityRaw === undefined ? {} : { maintainabilityRaw }) };
}

function rawIn(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(field, 'a finite number');
  return value;
}

function objectIn(value: unknown, field: string): JsonObject {
  if (!isJsonObject(value)) invalid(field, 'an object');
  return value;
}

function invalid(field: string, expected: string): never {
  throw new CommandError(`Invalid snapshot observations at ${field}: expected ${expected}.`);
}
