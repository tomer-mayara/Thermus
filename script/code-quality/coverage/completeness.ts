import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CommandError } from '../shared/repository.ts';

const incomplete = 'A captured child did not flush coverage on normal shutdown. Incomplete captures are unverified.';
export function assertCompleteCapture(folder: string): void {
  const names = readdirSync(folder);
  const { observed, completed } = shutdownEvidenceIn(folder, names);
  const captured = capturedIdentitiesIn(names);
  const missing = new Set([...observed].filter((identity) => !completed.has(identity) || !captured.has(identity)));
  for (const identity of captured) if (!completed.has(identity)) missing.add(identity);
  if (missing.size > 0) throw new CommandError(`${incomplete} Missing shutdown or flush evidence for ${missing.size} process/thread identities: ${missingIdentitiesOf(missing)}.`);
}
function shutdownEvidenceIn(folder: string, names: readonly string[]) {
  const markers = names.filter((name) => /^process-.*\.json$/.test(name));
  if (markers.length === 0) throw new CommandError('The capture has no process shutdown evidence. Incomplete captures are unverified.');
  const observed = new Set<string>();
  const completed = new Set<string>();
  for (const marker of markers) {
    const { pid, threadId, complete } = shutdownMarkerIn(join(folder, marker));
    const identity = `${pid}:${threadId}`;
    if (observed.has(identity)) throw new CommandError(`Duplicate process shutdown evidence for pid ${pid}/thread ${threadId}. Incomplete captures are unverified.`);
    observed.add(identity);
    if (complete) completed.add(identity);
  }
  return { observed, completed };
}
function shutdownMarkerIn(file: string): { pid: number; threadId: number; complete: boolean } {
  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { record = {}; }
  if (record === null || !Number.isSafeInteger(record.pid) || record.pid <= 0 || !Number.isSafeInteger(record.threadId) || record.threadId < 0) throw new CommandError(`${incomplete} Invalid marker: ${file}.`);
  return { pid: record.pid, threadId: record.threadId, complete: record.complete === true };
}
function capturedIdentitiesIn(names: readonly string[]): ReadonlySet<string> {
  return new Set(names.flatMap((name) => {
    if (!/^coverage-.*\.json$/.test(name)) return [];
    const match = /^coverage-(\d+)-\d+-(\d+)\.json$/.exec(name);
    if (match === null) throw new CommandError(`${incomplete} Invalid V8 file identity: ${name}.`);
    return [`${Number(match[1])}:${Number(match[2])}`];
  }));
}
function missingIdentitiesOf(identities: ReadonlySet<string>): string {
  const sorted = [...identities].map((identity) => identity.split(':').map(Number))
    .sort(([firstPid, firstThread], [secondPid, secondThread]) => firstPid - secondPid || firstThread - secondThread);
  const first = sorted.slice(0, 3).map(([pid, thread]) => `pid ${pid}/thread ${thread}`).join(', ');
  return `${first}${sorted.length > 3 ? ` (+${sorted.length - 3} more)` : ''}`;
}
