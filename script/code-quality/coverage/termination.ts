import { join } from 'node:path';
import { rawFilesOf, type CaptureProtocol } from './protocol.ts';
import { sealRecordIn, assertSealedCapture } from './seal.ts';
import { CommandError } from '../shared/repository.ts';

export function completedMarker(folder: string, marker: Record<string, unknown>, protocol: CaptureProtocol | undefined): boolean {
  if (protocol === undefined) return marker.complete === true;
  assertMarkerProtocol(folder, marker, protocol);
  if (marker.state === 'sealed-before-crash') { assertSealedCapture(folder, marker, protocol); return true; }
  return marker.complete === true;
}

function assertMarkerProtocol(folder: string, record: Record<string, unknown>, protocol: CaptureProtocol): void {
  if (record.completionProtocol !== protocol.completionProtocol || record.captureId !== protocol.captureId) throw new CommandError('The process capture protocol or original capture identity does not match. Incomplete captures are unverified.');
  if (record.complete === true) assertFinalExitFlush(folder, record);
  if (record.complete === true && record.state !== 'normal-exit') throw new CommandError('Only normal exit can mark a process complete. Incomplete captures are unverified.');
}

function assertFinalExitFlush(folder: string, marker: Record<string, unknown>): void {
  if (!Array.isArray(marker.exitCheckpoint) || marker.exitCheckpoint.length === 0) throw new CommandError('The normal-exit capture has no exit checkpoint. Incomplete captures are unverified.');
  const final = rawFilesOf(folder, { pid: marker.pid as number, threadId: marker.threadId as number });
  if (JSON.stringify(marker.exitCheckpoint) === JSON.stringify(final)) throw new CommandError('The process has no later V8 flush after its checkpoint. Incomplete captures are unverified.');
}

export function assertSignalOutcomes(folder: string, evidence: { names: readonly string[]; observed: ReadonlySet<string>; captured: ReadonlySet<string>; sealed: ReadonlySet<string>; protocol?: CaptureProtocol }): void {
  const capturedPids = new Set([...evidence.observed, ...evidence.captured].map((identity) => Number(identity.split(':')[0])));
  for (const name of evidence.names.filter((name) => /^signal-.*\.json$/.test(name))) {
    const record = sealRecordIn(join(folder, name));
    if (!Number.isSafeInteger(record.pid) || typeof record.signal !== 'string') throw new CommandError('The observed process signal evidence is invalid. Incomplete captures are unverified.');
    if (!capturedPids.has(record.pid as number)) continue;
    if (evidence.protocol !== undefined && record.captureId !== evidence.protocol.captureId) throw new CommandError('The observed signal belongs to another capture identity. Incomplete captures are unverified.');
    if (record.signal !== 'SIGKILL' || !evidence.sealed.has(`${record.pid}:0`)) throw new CommandError(`Captured pid ${record.pid} ended on ${record.signal} without a verified pre-crash seal. Incomplete captures are unverified.`);
  }
}
