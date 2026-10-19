import { join } from 'node:path';
import type { MessagePort } from 'node:worker_threads';
import * as json from '../shared/json.ts';
import { completionProtocol, type CaptureProtocol, type ProcessIdentity, type RawFileIdentity } from './protocol.ts';

export const loaderProtocol = 'loader-flush-park-1';
export type LoaderIdentity = CaptureProtocol & ProcessIdentity & {
  readonly loaderProtocol: typeof loaderProtocol;
  readonly ownerThreadId: number;
  readonly nonce: string;
};
export type LoaderCheckpoint = readonly RawFileIdentity[];
export type LoaderAcknowledgement = LoaderIdentity & { readonly state: 'parked'; readonly checkpoint: LoaderCheckpoint };
export type LoaderInitialization = CaptureProtocol & {
  readonly folder: string;
  readonly ownerThreadId: number;
  readonly nonce: string;
  readonly port: MessagePort;
  readonly shared: SharedArrayBuffer;
};
type LoaderEvidenceKind = 'request' | 'ack' | 'receipt';

export function loaderEvidenceFile(folder: string, kind: LoaderEvidenceKind, identity: LoaderIdentity): string {
  return join(folder, `loader-${kind}-${identity.pid}-${identity.threadId}-${identity.nonce}.json`);
}

export function loaderIdentityIn(value: unknown): LoaderIdentity | undefined {
  const record = json.objectOf(value);
  if (record.completionProtocol !== completionProtocol || record.loaderProtocol !== loaderProtocol) return undefined;
  const binding = loaderBindingIn(record);
  const participant = loaderParticipantIn(record);
  if (binding === undefined || participant === undefined) return undefined;
  return { completionProtocol, loaderProtocol, ...binding, ...participant };
}

function loaderBindingIn(record: json.JsonObject): Pick<LoaderIdentity, 'captureId' | 'nonce'> | undefined {
  if (typeof record.captureId !== 'string' || !/^[a-f0-9]{64}$/.test(record.captureId)) return undefined;
  if (typeof record.nonce !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(record.nonce)) return undefined;
  return { captureId: record.captureId, nonce: record.nonce };
}

function loaderParticipantIn(record: json.JsonObject): Pick<LoaderIdentity, 'pid' | 'threadId' | 'ownerThreadId'> | undefined {
  const { pid, threadId, ownerThreadId } = record;
  if (!validThread(pid) || pid === 0 || !validThread(threadId) || threadId === 0) return undefined;
  if (!validThread(ownerThreadId) || threadId === ownerThreadId) return undefined;
  return { pid, threadId, ownerThreadId };
}

function validThread(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
