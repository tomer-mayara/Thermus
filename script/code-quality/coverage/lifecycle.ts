import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { takeCoverage } from 'node:v8';
import { threadId } from 'node:worker_threads';
import { captureIdOf, completionProtocol, writeCaptureMarker, rawFilesOf } from './protocol.ts';
import { propagateCapture } from './propagation.ts';
import { listenForCoverageSeal } from './seal-runtime.ts';

const folder = process.env.NODE_V8_COVERAGE;
if (folder) {
  propagateCapture(import.meta.url, folder);
  const marker = join(folder, `process-${process.pid}-${randomUUID()}.json`);
  const identity = { pid: process.pid, threadId, captureId: captureIdOf(folder), completionProtocol } as const;
  writeCaptureMarker(marker, { ...identity, state: 'running', complete: false });
  const canCaptureExit = listenForCoverageSeal({ ...identity, folder, marker });
  process.on('exit', () => {
    if (!canCaptureExit()) return;
    takeCoverage();
    writeCaptureMarker(marker, { ...identity, state: 'normal-exit', complete: true, exitCheckpoint: rawFilesOf(folder, identity) });
  });
}
