import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';

const persistMarker = writeFileSync;
const publishMarker = renameSync;

export const legacyCompletionProtocol = 'normal-exit-or-sealed-1';
export const completionProtocol = 'normal-exit-or-sealed-or-loader-1';
export const sealProtocol = 'pre-crash-seal-1';
export type CaptureProtocol = { readonly completionProtocol: typeof completionProtocol | typeof legacyCompletionProtocol; readonly captureId: string };
export type ProcessIdentity = { readonly pid: number; readonly threadId: number };
export type RawFileIdentity = { readonly name: string; readonly hash: string };
export function captureIdOf(folder: string): string {
  return createHash('sha256').update(resolve(folder)).digest('hex');
}
export function rawFilesOf(folder: string, process: ProcessIdentity): readonly RawFileIdentity[] {
  return readdirSync(folder).filter((name) => name.startsWith(`coverage-${process.pid}-`) && name.endsWith(`-${process.threadId}.json`)).sort()
    .map((name) => ({ name, hash: createHash('sha256').update(readFileSync(join(folder, name))).digest('hex') }));
}

export function writeCaptureMarker(file: string, record: unknown): void {
  const temporary = `${file}.${process.pid}.tmp`;
  persistMarker(temporary, JSON.stringify(record));
  publishMarker(temporary, file);
}
