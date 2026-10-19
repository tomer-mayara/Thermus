import childProcess from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureIdOf } from './protocol.ts';

// Exit markers alone cannot prove that a later signal did not stop the process.
export function observeSignalExit(value: unknown, folder: string): void {
  if (value === null || typeof value !== 'object') return;
  const result = value as { pid?: number; signal?: NodeJS.Signals; child?: unknown };
  const child = result.child ?? value;
  if (!(child instanceof childProcess.ChildProcess)) {
    writeSignalObservation(folder, result);
    return;
  }
  const pid = child.pid;
  let recorded = false;
  const observe = (_code: number | null, signal: NodeJS.Signals | null) => {
    if (recorded || signal === null) return;
    writeSignalObservation(folder, { pid, signal });
    recorded = true;
  };
  child.once('exit', observe);
  child.once('close', observe);
}

function writeSignalObservation(folder: string, result: { pid?: number; signal?: NodeJS.Signals }): void {
  if (!Number.isSafeInteger(result.pid) || (result.pid ?? 0) <= 0 || !result.signal) return;
  const file = join(folder, `signal-${result.pid}-${randomUUID()}.json`);
  writeFileSync(file, JSON.stringify({ pid: result.pid, signal: result.signal, captureId: captureIdOf(folder) }));
}
