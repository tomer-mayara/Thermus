import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { takeCoverage } from 'node:v8';
import { isInternalThread, threadId } from 'node:worker_threads';
import * as contract from './loader-contract.ts';
import * as protocol from './protocol.ts';

type Participant = protocol.CaptureProtocol & protocol.ProcessIdentity & { readonly folder: string; readonly marker: string };
const participantKey = Symbol.for('thermus.coverage.loaderParticipant');

export function prepareLoaderCapture(capture: protocol.CaptureProtocol & { readonly folder: string }): string {
  const runtime = globalThis as typeof globalThis & { [key: symbol]: Participant | undefined };
  const current = runtime[participantKey];
  const identity = { pid: process.pid, threadId, captureId: capture.captureId, completionProtocol: capture.completionProtocol };
  const folder = resolve(capture.folder);
  if (current !== undefined) {
    if (current.folder !== folder || Object.entries(identity).some(([key, value]) => current[key as keyof Participant] !== value)) throw new Error('The loader participant belongs to another capture or thread.');
    return current.marker;
  }
  const marker = join(folder, `process-${process.pid}-${randomUUID()}.json`);
  protocol.writeCaptureMarker(marker, { ...identity, state: 'loader-awaiting-owner', complete: false });
  runtime[participantKey] = Object.freeze({ ...identity, folder, marker });
  return marker;
}

// Node calls this entry in the existing asynchronous module loader thread.
export function initialize(capture: contract.LoaderInitialization): void {
  if (!isInternalThread) throw new Error('The coverage observer requires an internal loader thread.');
  const identity: contract.LoaderIdentity = {
    completionProtocol: capture.completionProtocol, loaderProtocol: contract.loaderProtocol, pid: process.pid, threadId,
    ownerThreadId: capture.ownerThreadId, captureId: capture.captureId, nonce: capture.nonce,
  };
  const marker = prepareLoaderCapture(capture);
  protocol.writeCaptureMarker(marker, { ...identity, state: 'loader-running', complete: false });
  capture.port.on('message', (message: unknown) => parkForShutdown({ capture, identity, marker }, message));
  capture.port.unref();
  const shared = new Int32Array(capture.shared);
  Atomics.store(shared, 1, threadId);
  Atomics.store(shared, 0, 1);
}

function parkForShutdown(observer: { capture: contract.LoaderInitialization; identity: contract.LoaderIdentity; marker: string }, message: unknown): void {
  const { capture, identity, marker } = observer;
  if (JSON.stringify(message) !== JSON.stringify(identity)) return;
  const request = readFileSync(contract.loaderEvidenceFile(capture.folder, 'request', identity), 'utf8');
  if (request !== JSON.stringify(identity)) return;
  takeCoverage();
  const checkpoint = protocol.rawFilesOf(capture.folder, identity);
  if (checkpoint.length === 0) return;
  protocol.writeCaptureMarker(marker, { ...identity, state: 'loader-parked', complete: false, checkpoint });
  protocol.writeCaptureMarker(contract.loaderEvidenceFile(capture.folder, 'ack', identity), { ...identity, state: 'parked', checkpoint });
  const shared = new Int32Array(capture.shared);
  Atomics.store(shared, 0, 2);
  Atomics.notify(shared, 0);
  // Keep V8 active for Node's final flush. This private lock can never be notified.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
