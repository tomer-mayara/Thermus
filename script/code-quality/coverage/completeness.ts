import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CaptureProtocol } from './protocol.ts';
import { completedMarker, assertSignalOutcomes } from './termination.ts';
import { verifiedLoadersIn } from './loader-validation.ts';
import { CommandError } from '../shared/repository.ts';

const incomplete = 'A captured child did not flush coverage on normal shutdown. Incomplete captures are unverified.';
export function assertCompleteCapture(folder: string, protocol?: CaptureProtocol): void {
  const names = readdirSync(folder);
  const { observed, completed, sealed } = shutdownEvidenceIn(folder, { names, protocol });
  const captured = capturedIdentitiesIn(names);
  assertSignalOutcomes(folder, { names, observed, captured, sealed, protocol });
  const missing = new Set([...observed].filter((identity) => !completed.has(identity) || !captured.has(identity)));
  for (const identity of captured) if (!completed.has(identity)) missing.add(identity);
  if (missing.size > 0) throw new CommandError(`${incomplete} Missing shutdown or flush evidence for ${missing.size} process/thread identities: ${missingIdentitiesOf(missing)}.`);
}
function shutdownEvidenceIn(folder: string, evidence: { names: readonly string[]; protocol?: CaptureProtocol }) {
  const { names, protocol } = evidence;
  const markers = names.filter((name) => /^process-.*\.json$/.test(name));
  if (markers.length === 0) throw new CommandError('The capture has no process shutdown evidence. Incomplete captures are unverified.');
  const observed = new Set<string>();
  const completed = new Set<string>();
  const sealed = new Set<string>();
  const records = new Map<string, ReturnType<typeof shutdownMarkerIn>>();
  for (const marker of markers) {
    const file = join(folder, marker);
    const record = shutdownMarkerIn(file);
    const { pid, threadId } = record;
    const complete = completedMarker(folder, record, protocol);
    const identity = `${pid}:${threadId}`;
    if (observed.has(identity)) throw new CommandError(`Duplicate process shutdown evidence for pid ${pid}/thread ${threadId}. Incomplete captures are unverified.`);
    observed.add(identity);
    records.set(identity, record);
    if (complete) completed.add(identity);
    if (complete && record.state === 'sealed-before-crash') sealed.add(identity);
  }
  for (const identity of verifiedLoadersIn(folder, { ...evidence, markers: records, completed })) completed.add(identity);
  return { observed, completed, sealed };
}
function shutdownMarkerIn(file: string): Record<string, unknown> & { pid: number; threadId: number } {
  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { record = {}; }
  if (record === null || !Number.isSafeInteger(record.pid) || record.pid <= 0 || !Number.isSafeInteger(record.threadId) || record.threadId < 0) throw new CommandError(`${incomplete} Invalid marker: ${file}.`);
  return record;
}
function capturedIdentitiesIn(names: readonly string[]): ReadonlySet<string> {
  return new Set(names.flatMap((name) => {
    if (!/^coverage-.*\.json$/.test(name)) return [];
    const match = /^coverage-([1-9]\d*)-([1-9]\d*)-(0|[1-9]\d*)\.json$/.exec(name);
    if (match === null || !match.slice(1).every((value) => Number.isSafeInteger(Number(value)))) throw new CommandError(`${incomplete} Invalid V8 file identity: ${name}.`);
    return [`${Number(match[1])}:${Number(match[3])}`];
  }));
}
function missingIdentitiesOf(identities: ReadonlySet<string>): string {
  const sorted = [...identities].map((identity) => identity.split(':').map(Number))
    .sort(([firstPid, firstThread], [secondPid, secondThread]) => firstPid - secondPid || firstThread - secondThread);
  const first = sorted.slice(0, 3).map(([pid, thread]) => `pid ${pid}/thread ${thread}`).join(', ');
  return `${first}${sorted.length > 3 ? ` (+${sorted.length - 3} more)` : ''}`;
}
