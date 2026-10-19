import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as v8 from 'node:v8';
import * as protocol from './protocol.ts';
import { hasActiveCaptureWorkers } from './propagation.ts';
import * as evidence from './seal.ts';

type RuntimeCapture = protocol.CaptureProtocol & protocol.ProcessIdentity & { readonly folder: string; readonly marker: string };
export function listenForCoverageSeal(capture: RuntimeCapture): () => boolean {
  let stopped = false;
  const seal = (message: unknown) => {
    const request = evidence.sealRequestIn(message);
    if (request === undefined || request.pid !== capture.pid || request.captureId !== capture.captureId) return;
    const reject = (reason: string) => protocol.writeCaptureMarker(capture.marker, { ...capture, state: 'seal-rejected', complete: false, reason });
    const rejection = sealRejection(capture, request);
    if (rejection !== undefined) { reject(rejection); return; }
    v8.takeCoverage();
    stopped = true;
    v8.stopCoverage();
    const files = protocol.rawFilesOf(capture.folder, capture);
    if (files.length === 0) { reject('The seal has no raw V8 flush.'); return; }
    protocol.writeCaptureMarker(capture.marker, { ...request, completionProtocol: capture.completionProtocol, state: 'sealed-before-crash', complete: false, files });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  };
  if (process.env.THERMUS_COVERAGE_CRASH === '1') process.on('message', seal);
  const preparedNonce = process.env.THERMUS_COVERAGE_SEAL_NONCE;
  const runtime = globalThis as typeof globalThis & { [key: symbol]: unknown };
  if (preparedNonce !== undefined) runtime[Symbol.for('thermus.coverage.sealBeforeCrash')] = () => seal({ protocol: 'pre-crash-seal-1', captureId: capture.captureId, pid: capture.pid, threadId: capture.threadId, nonce: preparedNonce });
  return () => !stopped;
}
function hasWorkerEvidence(capture: RuntimeCapture): boolean {
  const names = readdirSync(capture.folder);
  if (names.some((name) => name.startsWith(`coverage-${capture.pid}-`) && /^coverage-\d+-\d+-(?!0\.json$)\d+\.json$/.test(name))) return true;
  return names.filter((name) => name.startsWith(`process-${capture.pid}-`) && name.endsWith('.json')).some((name) => {
    const marker = evidence.sealRecordIn(join(capture.folder, name));
    return marker.threadId !== capture.threadId;
  });
}

function sealRejection(capture: RuntimeCapture, request: evidence.SealRequest): string | undefined {
  if (capture.threadId !== 0 || request.threadId !== 0) return 'Only the main thread can seal a crash capture.';
  if (JSON.stringify(evidence.sealRecordIn(evidence.requestFileOf(capture.folder, request))) !== JSON.stringify(request)) return 'The seal request evidence does not match.';
  if (hasActiveCaptureWorkers() || hasWorkerEvidence(capture)) return 'Captured workers cannot seal a crash capture.';
  return undefined;
}
