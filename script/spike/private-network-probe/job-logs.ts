import { fieldJson, fieldText } from '../render-tenant-lifecycle/answers.ts';
import { sleep } from '../render-tenant-lifecycle/polls.ts';
import { logsCall, PROBE_MARK } from './calls.ts';
import type { ProbeContext, TranscriptLine } from './context.ts';

export const LOG_POLL = { everyMs: 5_000, attempts: 18 } as const;
const MAX_PAGES = 10;
const WINDOW_SLACK_MS = 10_000;

interface LogEntry {
  readonly timestamp: string;
  readonly message: string;
  readonly labels: Readonly<Record<string, string>>;
}

export interface ProbeLine {
  readonly entry: LogEntry;
  readonly from: string;
  readonly url: string;
  readonly status?: number;
  readonly body?: string;
  readonly error?: string;
  readonly message?: string;
  readonly ms?: number;
}

export interface LinesRead {
  readonly lines: readonly ProbeLine[];
  readonly entries: number;
  readonly reads: number;
  readonly ms: number;
  readonly resources: readonly string[];
}

function labelsOf(value: unknown): Readonly<Record<string, string>> {
  const labels = Array.isArray(value) ? value : [];
  return Object.fromEntries(labels.map((label) => [fieldText(label, 'name') ?? '', fieldText(label, 'value') ?? '']));
}

function entriesOf(value: unknown): readonly LogEntry[] {
  const logs = fieldJson(value, 'logs');
  const items = Array.isArray(logs) ? logs : [];
  return items.map((item) => ({ timestamp: fieldText(item, 'timestamp') ?? '', message: fieldText(item, 'message') ?? '', labels: labelsOf(fieldJson(item, 'labels')) }));
}

function numberOf(value: unknown, key: string): number | undefined {
  const field = fieldJson(value, key);
  return typeof field === 'number' ? field : undefined;
}

// A line of this run is a JSON object with the probe mark and the run of this probe. Text before the object is allowed.
function probeLine(entry: LogEntry, run: string): ProbeLine | undefined {
  const start = entry.message.indexOf('{');
  if (start < 0) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(entry.message.slice(start));
  } catch {
    return undefined;
  }
  if (fieldText(value, 'probe') !== PROBE_MARK || fieldText(value, 'run') !== run) return undefined;
  return {
    entry, from: fieldText(value, 'from') ?? '', url: fieldText(value, 'url') ?? '', status: numberOf(value, 'status'), body: fieldText(value, 'body'),
    error: fieldText(value, 'error'), message: fieldText(value, 'message'), ms: numberOf(value, 'ms'),
  };
}

async function readWindow(context: ProbeContext, resources: readonly string[], startTime: string): Promise<readonly LogEntry[]> {
  const entries: LogEntry[] = [];
  let window = { startTime, endTime: new Date().toISOString() };
  for (let page = 1; page <= MAX_PAGES; page++) {
    const answer = await context.client.read(logsCall(context.inputs.owner, resources, window), context.signal);
    entries.push(...entriesOf(answer.json));
    const next = { startTime: fieldText(answer.json, 'nextStartTime'), endTime: fieldText(answer.json, 'nextEndTime') };
    if (fieldJson(answer.json, 'hasMore') !== true || next.startTime === undefined || next.endTime === undefined) return entries;
    window = { startTime: next.startTime, endTime: next.endTime };
  }
  throw new Error(`The log list has more than ${MAX_PAGES} pages for one window`);
}

// Reads the log lines of the job until each target has its line, at most LOG_POLL.attempts times.
export async function readProbeLines(context: ProbeContext, resources: readonly string[], since: { readonly createdAt: number; readonly targets: number }): Promise<LinesRead> {
  const started = performance.now();
  const startTime = new Date(since.createdAt - WINDOW_SLACK_MS).toISOString();
  let entries: readonly LogEntry[] = [];
  for (let reads = 1; ; reads++) {
    entries = await readWindow(context, resources, startTime);
    const lines = entries.map((entry) => probeLine(entry, context.run)).filter((line) => line !== undefined);
    if (lines.length >= since.targets || reads === LOG_POLL.attempts) return { lines, entries: entries.length, reads, ms: performance.now() - started, resources };
    await sleep(LOG_POLL.everyMs, context.signal);
  }
}

export function transcriptOf(lines: readonly ProbeLine[]): readonly TranscriptLine[] {
  return lines.map(({ entry }) => ({
    timestamp: entry.timestamp,
    labels: ['resource', 'instance', 'type', 'level'].map((name) => `${name}=${entry.labels[name] ?? 'absent'}`).join(' '),
    message: entry.message,
  }));
}
