import module from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MessageChannel, threadId, type MessagePort } from 'node:worker_threads';
import * as contract from './loader-contract.ts';
import * as protocol from './protocol.ts';

type OwnerCapture = protocol.CaptureProtocol & { readonly folder: string };
type LoaderConnection = { readonly identity: contract.LoaderIdentity; readonly port: MessagePort; readonly shared: Int32Array; readonly folder: string };
const shutdownTimeout = 3_000;

export function observeLoaderShutdown(capture: OwnerCapture): void {
  const register = module.register;
  let loader: LoaderConnection | undefined;
  module.register = function (this: unknown, ...args: unknown[]) {
    const result = Reflect.apply(register, this, args);
    loader ??= registerObserver(capture, register);
    return result;
  };
  module.syncBuiltinESMExports();
  afterExitListeners(() => { if (loader !== undefined) requestLoaderPark(loader); });
}

function registerObserver(capture: OwnerCapture, register: typeof module.register): LoaderConnection {
  const { port1, port2 } = new MessageChannel();
  const shared = new Int32Array(new SharedArrayBuffer(8));
  const nonce = randomUUID();
  register(new URL('./loader-observer.ts', import.meta.url), {
    data: { ...capture, ownerThreadId: threadId, nonce, port: port2, shared: shared.buffer }, transferList: [port2],
  });
  port1.unref();
  const loaderThreadId = Atomics.load(shared, 1);
  if (Atomics.load(shared, 0) !== 1 || loaderThreadId <= 0 || loaderThreadId === threadId) throw new Error('The coverage loader did not identify its thread.');
  const identity: contract.LoaderIdentity = {
    completionProtocol: capture.completionProtocol, loaderProtocol: contract.loaderProtocol, pid: process.pid, threadId: loaderThreadId,
    ownerThreadId: threadId, captureId: capture.captureId, nonce,
  };
  return { identity, port: port1, shared, folder: capture.folder };
}

function afterExitListeners(shutdown: () => void): void {
  const emit = process.emit;
  let depth = 0;
  let requested = false;
  process.emit = function (this: NodeJS.Process, event: string | symbol, ...args: unknown[]): unknown {
    if (this !== process || event !== 'exit') return Reflect.apply(emit, this, [event, ...args]);
    depth += 1;
    try {
      const result = Reflect.apply(emit, this, [event, ...args]);
      // Node 24 sets this private flag before a real exit. Manual emits must not park.
      if (depth === 1 && (process as NodeJS.Process & { _exiting?: boolean })._exiting === true && !requested) {
        requested = true;
        shutdown();
      }
      return result;
    } finally { depth -= 1; }
  } as typeof emit;
}

function requestLoaderPark(loader: LoaderConnection): void {
  const { identity, folder, shared } = loader;
  const deadline = performance.now() + shutdownTimeout;
  protocol.writeCaptureMarker(contract.loaderEvidenceFile(folder, 'request', identity), identity);
  loader.port.postMessage(identity);
  Atomics.wait(shared, 0, 1, Math.max(0, deadline - performance.now()));
  const checkpoint = acknowledgedCheckpoint(loader, deadline);
  const receipt = checkpoint === undefined ? { ...identity, state: 'timeout' } : { ...identity, state: 'acknowledged', checkpoint };
  protocol.writeCaptureMarker(contract.loaderEvidenceFile(folder, 'receipt', identity), receipt);
}

function acknowledgedCheckpoint(loader: LoaderConnection, deadline: number): contract.LoaderCheckpoint | undefined {
  if (Atomics.load(loader.shared, 0) !== 2) return undefined;
  try {
    const ack = JSON.parse(readFileSync(contract.loaderEvidenceFile(loader.folder, 'ack', loader.identity), 'utf8')) as contract.LoaderAcknowledgement;
    if (ack.state !== 'parked' || !Array.isArray(ack.checkpoint) || ack.checkpoint.length === 0) return undefined;
    if (JSON.stringify(ack) !== JSON.stringify({ ...loader.identity, state: 'parked', checkpoint: ack.checkpoint })) return undefined;
    return coverageClockAdvanced(ack.checkpoint, { shared: loader.shared, deadline }) ? ack.checkpoint : undefined;
  } catch { return undefined; }
}

function coverageClockAdvanced(checkpoint: contract.LoaderCheckpoint, wait: { shared: Int32Array; deadline: number }): boolean {
  const lastTimestamp = Math.max(...checkpoint.map(({ name }) => Number(/^coverage-\d+-(\d+)-\d+\.json$/.exec(name)?.[1])));
  if (!Number.isSafeInteger(lastTimestamp)) return false;
  while (Date.now() <= lastTimestamp && performance.now() < wait.deadline) Atomics.wait(wait.shared, 0, 2, 1);
  return Date.now() > lastTimestamp && performance.now() < wait.deadline;
}
