import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import * as json from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import type * as protocol from './protocol.ts';
import * as loader from './loader-contract.ts';
import { assertLoaderFinalFlush } from './loader-checkpoint.ts';

type CaptureEvidence = { readonly names: readonly string[]; readonly markers: ReadonlyMap<string, json.JsonObject>; readonly completed: ReadonlySet<string>; readonly protocol?: protocol.CaptureProtocol };
export function verifiedLoadersIn(folder: string, evidence: CaptureEvidence): ReadonlySet<string> {
  const loaders = [...evidence.markers.values()].filter(isLoaderMarker);
  const files = evidence.names.filter((name) => /^loader-.*\.json$/.test(name));
  const expected = new Set<string>();
  const completed = new Set<string>();
  for (const marker of loaders) {
    const identity = loaderIdentityOf(marker, evidence.protocol);
    assertNormalOwner(identity, evidence);
    for (const file of assertLoaderProof(folder, marker, identity)) expected.add(file);
    completed.add(`${identity.pid}:${identity.threadId}`);
  }
  if (files.length !== expected.size || files.some((file) => !expected.has(file))) invalidLoader();
  return completed;
}

export function assertLegacyLoaderAbsence(folder: string): void {
  const names = readdirSync(folder);
  if (names.some((name) => /^loader-.*\.json$/.test(name))) invalidLoader();
  const markers = names.filter((name) => /^process-.*\.json$/.test(name));
  if (markers.some((name) => isLoaderMarker(recordIn(join(folder, name))))) invalidLoader();
}

function loaderIdentityOf(marker: json.JsonObject, capture: protocol.CaptureProtocol | undefined): loader.LoaderIdentity {
  const identity = loader.loaderIdentityIn(marker);
  if (identity === undefined || capture === undefined) invalidLoader();
  if (identity.completionProtocol !== capture.completionProtocol || identity.captureId !== capture.captureId) invalidLoader();
  return identity;
}

function assertNormalOwner(identity: loader.LoaderIdentity, evidence: CaptureEvidence): void {
  const owner = `${identity.pid}:${identity.ownerThreadId}`;
  const marker = evidence.markers.get(owner);
  if (marker?.state !== 'normal-exit' || marker.complete !== true || !evidence.completed.has(owner)) invalidLoader();
  if (marker.loaderProtocol !== undefined || marker.completionProtocol !== identity.completionProtocol || marker.captureId !== identity.captureId) invalidLoader();
}

function assertLoaderProof(folder: string, marker: json.JsonObject, identity: loader.LoaderIdentity): readonly string[] {
  const { checkpoint } = marker;
  if (!isDeepStrictEqual(marker, { ...identity, state: 'loader-parked', complete: false, checkpoint })) invalidLoader();
  const records = [
    ['request', identity],
    ['ack', { ...identity, state: 'parked', checkpoint }],
    ['receipt', { ...identity, state: 'acknowledged', checkpoint }],
  ] as const;
  const names = records.map(([kind, expected]) => {
    const file = loader.loaderEvidenceFile(folder, kind, identity);
    if (!isDeepStrictEqual(recordIn(file), expected)) invalidLoader();
    return basename(file);
  });
  assertLoaderFinalFlush(folder, identity, checkpoint);
  return names;
}

function isLoaderMarker(marker: json.JsonObject): boolean {
  return marker.loaderProtocol !== undefined || (typeof marker.state === 'string' && marker.state.startsWith('loader-'));
}
function recordIn(file: string): json.JsonObject {
  try { return json.objectOf(json.jsonOf(readFileSync(file, 'utf8'))); } catch { return {}; }
}
function invalidLoader(): never {
  throw new CommandError('The loader shutdown request, acknowledgement, or normal owner proof is missing, stale, or changed. Incomplete captures are unverified.');
}
