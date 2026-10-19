import { join } from 'node:path';
import type { MessagePort } from 'node:worker_threads';
import type { CaptureProtocol, ProcessIdentity, RawFileIdentity } from './protocol.ts';

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
