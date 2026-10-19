import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { objectOf, jsonOf, type JsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import { rawFilesOf, sealProtocol, type CaptureProtocol, type ProcessIdentity } from './protocol.ts';

export type SealRequest = ProcessIdentity & { readonly protocol: typeof sealProtocol; readonly captureId: string; readonly nonce: string };
export function sealRequestIn(value: unknown): SealRequest | undefined {
  const record = objectOf(value);
  if (record.protocol !== sealProtocol || typeof record.captureId !== 'string' || !/^[a-f0-9]{64}$/.test(record.captureId)) return undefined;
  if (typeof record.nonce !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(record.nonce)) return undefined;
  if (!validProcessIdentity(record)) return undefined;
  return { protocol: sealProtocol, captureId: record.captureId, pid: record.pid as number, threadId: record.threadId as number, nonce: record.nonce };
}
export function requestFileOf(folder: string, request: SealRequest): string { return join(folder, `seal-request-${request.pid}-${request.nonce}.json`); }
export function sealRecordIn(file: string): JsonObject {
  try { return objectOf(jsonOf(readFileSync(file, 'utf8'))); } catch { return {}; }
}
export function assertSealedCapture(folder: string, marker: JsonObject, protocol: CaptureProtocol): void {
  const request = sealRequestIn(marker);
  if (request === undefined || request.threadId !== 0 || request.captureId !== protocol.captureId || marker.complete !== false) invalidSeal();
  if (JSON.stringify(sealRecordIn(requestFileOf(folder, request))) !== JSON.stringify(request)) invalidSeal();
  assertCrashReceipt(folder, { request, files: marker.files });
}
function assertCrashReceipt(folder: string, seal: { request: SealRequest; files: unknown }): void {
  const { request } = seal;
  const files = rawFilesOf(folder, request);
  if (files.length === 0 || JSON.stringify(files) !== JSON.stringify(seal.files)) invalidSeal();
  const receipt = sealRecordIn(join(folder, `seal-receipt-${request.pid}-${request.nonce}.json`));
  if (receipt.signal !== 'SIGKILL' || JSON.stringify(sealRequestIn(receipt)) !== JSON.stringify(request) || JSON.stringify(receipt.files) !== JSON.stringify(files)) invalidSeal();
}

function invalidSeal(): never { throw new CommandError('The pre-crash coverage seal is missing, stale, or changed. Incomplete captures are unverified.'); }

function validProcessIdentity(record: JsonObject): boolean {
  return Number.isSafeInteger(record.pid) && (record.pid as number) > 0 && Number.isSafeInteger(record.threadId) && (record.threadId as number) >= 0;
}
