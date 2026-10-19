import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoaderIdentity } from '../../../../script/code-quality/coverage/loader-contract.ts';
import type { RawFileIdentity } from '../../../../script/code-quality/coverage/protocol.ts';

export function loaderCaptureIn(folder: string, threads = { threadId: 1, ownerThreadId: 0 }) {
  const protocol = { completionProtocol: 'normal-exit-or-sealed-or-loader-1', captureId: 'a'.repeat(64) } as const;
  const identity: LoaderIdentity = { ...protocol, loaderProtocol: 'loader-flush-park-1', pid: 42, ...threads, nonce: '12345678-1234-1234-1234-123456789abc' };
  const checkpoint = [100, 110].map((time) => rawFileIn(folder, { pid: identity.pid, time, threadId: identity.threadId }));
  const ownerCheckpoint = rawFileIn(folder, { pid: identity.pid, time: 100, threadId: identity.ownerThreadId });
  const final = rawFileIn(folder, { pid: identity.pid, time: 120, threadId: identity.threadId });
  const ownerFinal = rawFileIn(folder, { pid: identity.pid, time: 120, threadId: identity.ownerThreadId });
  const stem = `${identity.pid}-${identity.threadId}-${identity.nonce}.json`;
  const files = { marker: 'process-loader.json', owner: 'process-owner.json', request: `loader-request-${stem}`, ack: `loader-ack-${stem}`, receipt: `loader-receipt-${stem}` };
  writeFileSync(join(folder, files.owner), JSON.stringify({ ...protocol, pid: identity.pid, threadId: identity.ownerThreadId, state: 'normal-exit', complete: true, exitCheckpoint: [ownerCheckpoint] }));
  writeFileSync(join(folder, files.marker), JSON.stringify({ ...identity, state: 'loader-parked', complete: false, checkpoint }));
  writeFileSync(join(folder, files.request), JSON.stringify(identity));
  writeFileSync(join(folder, files.ack), JSON.stringify({ ...identity, state: 'parked', checkpoint }));
  writeFileSync(join(folder, files.receipt), JSON.stringify({ ...identity, state: 'acknowledged', checkpoint }));
  return { protocol, identity, checkpoint, final, ownerCheckpoint, ownerFinal, files };
}

function rawFileIn(folder: string, identity: { pid: number; threadId: number; time: number }): RawFileIdentity {
  const name = `coverage-${identity.pid}-${identity.time}-${identity.threadId}.json`;
  const text = JSON.stringify({ result: [], timestamp: identity.time });
  writeFileSync(join(folder, name), text);
  return { name, hash: createHash('sha256').update(text).digest('hex') };
}

export function changeLoaderRecord(folder: string, file: string, change: Record<string, unknown>): void {
  const path = join(folder, file);
  writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), ...change }));
}
