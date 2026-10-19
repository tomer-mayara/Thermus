import type { ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

type RawFile = { name: string; hash: string };
type SealRequest = { protocol: string; captureId: string; pid: number; threadId: number; nonce: string };
type PreparedSeal = { folder: string; request: SealRequest; files: readonly RawFile[] };
const protocol = 'pre-crash-seal-1';
const prepared = new WeakMap<ChildProcess, SealRequest>();
export function prepareCrashChild(child: ChildProcess, nonce: string): void {
  const folder = process.env.NODE_V8_COVERAGE;
  if (folder !== undefined) prepared.set(child, requestFor(child, { folder, nonce }));
}
export async function crashChild(child: ChildProcess, whileSealed: () => Promise<void> = async () => {}): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, 'close');
  try {
    const folder = process.env.NODE_V8_COVERAGE;
    const seal = folder === undefined ? undefined : await prepareSeal(child, folder);
    if (seal !== undefined) await whileSealed();
    child.kill('SIGKILL');
    const [code, signal] = await closed;
    if (seal !== undefined) finishSeal(seal, { code, signal });
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await closed; }
  }
}
function requestFor(child: ChildProcess, capture: { folder: string; nonce: string }): SealRequest {
  if (!child.connected || child.pid === undefined) throw new Error('The captured crash child needs an IPC channel.');
  const request = { protocol, captureId: hashOf(Buffer.from(resolve(capture.folder))), pid: child.pid, threadId: 0, nonce: capture.nonce };
  writeFileSync(join(capture.folder, `seal-request-${request.pid}-${request.nonce}.json`), JSON.stringify(request));
  return request;
}
async function prepareSeal(child: ChildProcess, folder: string): Promise<PreparedSeal> {
  const request = prepared.get(child) ?? requestFor(child, { folder, nonce: randomUUID() });
  if (!prepared.has(child)) child.send(request);
  const marker = await sealedMarkerIn(folder, request);
  return { folder, request, files: marker.files };
}
function finishSeal(seal: PreparedSeal, outcome: { code: unknown; signal: unknown }): void {
  if (outcome.code !== null || outcome.signal !== 'SIGKILL') throw new Error('The sealed child did not end with SIGKILL.');
  assertRawFiles(seal.folder, seal.files, seal.request.pid);
  writeFileSync(join(seal.folder, `seal-receipt-${seal.request.pid}-${seal.request.nonce}.json`), JSON.stringify({ ...seal.request, signal: outcome.signal, files: seal.files }));
}
async function sealedMarkerIn(folder: string, request: SealRequest): Promise<{ files: readonly RawFile[] }> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    for (const name of readdirSync(folder).filter((name) => name.startsWith(`process-${request.pid}-`) && name.endsWith('.json'))) {
      const marker = JSON.parse(readFileSync(join(folder, name), 'utf8'));
      if (marker.state === 'seal-rejected') throw new Error(`Coverage seal rejected: ${marker.reason}`);
      if (marker.state !== 'sealed-before-crash' || marker.nonce !== request.nonce || marker.captureId !== request.captureId) continue;
      assertRawFiles(folder, marker.files, request.pid);
      return marker;
    }
    await delay(10);
  }
  throw new Error('The captured child did not acknowledge the coverage seal. Enable the crash fixture protocol before launch.');
}
function assertRawFiles(folder: string, files: readonly RawFile[], pid: number): void {
  const actual = readdirSync(folder).filter((name) => name.startsWith(`coverage-${pid}-`) && name.endsWith('-0.json')).sort();
  if (!Array.isArray(files) || files.length === 0 || JSON.stringify(files.map(({ name }) => name)) !== JSON.stringify(actual)) throw new Error('The sealed raw file set changed.');
  if (files.some(({ name, hash }) => hashOf(readFileSync(join(folder, name))) !== hash)) throw new Error('The sealed raw file content changed.');
}
function hashOf(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }
