import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { takeCoverage } from 'node:v8';
import { isInternalThread, threadId } from 'node:worker_threads';
import * as protocol from './protocol.ts';
import { propagateCapture } from './propagation.ts';
import { listenForCoverageSeal } from './seal-runtime.ts';
import { observeLoaderShutdown } from './loader-runtime.ts';
import { prepareLoaderCapture } from './loader-observer.ts';

const folder = process.env.NODE_V8_COVERAGE;
if (folder && isInternalThread) prepareLoaderCapture({ folder, captureId: protocol.captureIdOf(folder), completionProtocol: protocol.completionProtocol });
if (folder && !isInternalThread) {
  propagateCapture(import.meta.url, folder);
  const marker = join(folder, `process-${process.pid}-${randomUUID()}.json`);
  const identity = { pid: process.pid, threadId, captureId: protocol.captureIdOf(folder), completionProtocol: protocol.completionProtocol } as const;
  observeLoaderShutdown({ folder, captureId: identity.captureId, completionProtocol: identity.completionProtocol });
  protocol.writeCaptureMarker(marker, { ...identity, state: 'running', complete: false });
  const canCaptureExit = listenForCoverageSeal({ ...identity, folder, marker });
  process.on('exit', () => {
    if (!canCaptureExit()) return;
    takeCoverage();
    protocol.writeCaptureMarker(marker, { ...identity, state: 'normal-exit', complete: true, exitCheckpoint: protocol.rawFilesOf(folder, identity) });
  });
}
