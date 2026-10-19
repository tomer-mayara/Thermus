import { isDeepStrictEqual } from 'node:util';
import { objectOf } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import { rawFilesOf, type ProcessIdentity, type RawFileIdentity } from './protocol.ts';

export function assertLoaderFinalFlush(folder: string, identity: ProcessIdentity, value: unknown): void {
  const checkpoint = checkpointIn(value, identity);
  let current;
  try { current = rawFilesOf(folder, identity); } catch { invalidCheckpoint(); }
  const unchanged = current.filter(({ name }) => checkpoint.some((file) => file.name === name));
  if (!isDeepStrictEqual(unchanged, checkpoint)) invalidCheckpoint();
  const final = current.filter(({ name }) => !checkpoint.some((file) => file.name === name));
  if (final.length !== 1) invalidCheckpoint();
  const last = Math.max(...checkpoint.map(({ name }) => rawTimestampOf(name, identity)));
  if (rawTimestampOf(final[0].name, identity) <= last) invalidCheckpoint();
}

function checkpointIn(value: unknown, identity: ProcessIdentity): readonly RawFileIdentity[] {
  if (!Array.isArray(value) || value.length === 0) invalidCheckpoint();
  const files = value.map((item) => checkpointFileIn(item, identity));
  const names = files.map(({ name }) => name);
  if (new Set(names).size !== names.length || !isDeepStrictEqual(names, [...names].sort())) invalidCheckpoint();
  return files;
}

function checkpointFileIn(value: unknown, identity: ProcessIdentity): RawFileIdentity {
  const record = objectOf(value);
  if (typeof record.name !== 'string' || typeof record.hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.hash)) invalidCheckpoint();
  const file = { name: record.name, hash: record.hash };
  if (!isDeepStrictEqual(value, file)) invalidCheckpoint();
  rawTimestampOf(file.name, identity);
  return file;
}

function rawTimestampOf(name: string, identity: ProcessIdentity): number {
  const match = /^coverage-([1-9]\d*)-([1-9]\d*)-(0|[1-9]\d*)\.json$/.exec(name);
  if (match === null) invalidCheckpoint();
  const [, pid, time, threadId] = match.map(Number);
  if (pid !== identity.pid || threadId !== identity.threadId || !Number.isSafeInteger(time)) invalidCheckpoint();
  return time;
}

function invalidCheckpoint(): never {
  throw new CommandError('The loader checkpoint or later V8 flush is missing, stale, or changed. Incomplete captures are unverified.');
}
