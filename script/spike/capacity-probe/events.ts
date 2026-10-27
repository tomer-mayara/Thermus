import { eventsCall } from '../render-tenant-lifecycle/calls.ts';
import { listItems } from '../render-tenant-lifecycle/answers.ts';
import { seconds } from '../render-tenant-lifecycle/context.ts';
import type { RenderClient } from '../render-tenant-lifecycle/render-client.ts';

// A server_failed event is a kill or a crash of the instance. Its reason names the kind, such as oomKilled with the
// memory limit. The report keeps the reason keys, the memory limit, and the exit code; no other event detail, because
// an event detail can name a user (SO-01c).
export const KILL_TYPE = 'server_failed';
const CLOCK_SKEW_MS = 2_000;

export interface EventView {
  readonly type: string;
  readonly at: number;
  readonly reason?: string;
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reasonOf(details: unknown): string | undefined {
  const reason = isJson(details) && isJson(details.reason) ? details.reason : undefined;
  if (reason === undefined) return undefined;
  const parts = Object.keys(reason).filter((key) => reason[key] !== false && reason[key] !== undefined).sort();
  const oom = isJson(reason.oomKilled) && typeof reason.oomKilled.memoryLimit === 'string' ? ` (memory limit ${reason.oomKilled.memoryLimit})` : '';
  const exit = typeof reason.nonZeroExit === 'number' ? ` (exit ${reason.nonZeroExit})` : '';
  return `${parts.join(', ')}${oom}${exit}`;
}

export function eventViewsOf(value: unknown): readonly EventView[] {
  const events = listItems(value, 'event').items.filter(isJson);
  const views = events.map((event) => ({
    type: typeof event.type === 'string' ? event.type : 'unknown',
    at: Date.parse(typeof event.timestamp === 'string' ? event.timestamp : ''),
    reason: event.type === KILL_TYPE ? reasonOf(event.details) : undefined,
  }));
  return views.filter((event) => Number.isFinite(event.at)).sort((a, b) => a.at - b.at);
}

// The event list reads the last hour by default (SO-01c), so the probe filters by time itself.
export async function eventsSince(reader: { readonly client: RenderClient; readonly signal: AbortSignal }, serviceId: string, sinceMs: number): Promise<readonly EventView[]> {
  const answer = await reader.client.read(eventsCall(serviceId), reader.signal);
  return eventViewsOf(answer.json).filter((event) => event.at >= sinceMs - CLOCK_SKEW_MS);
}

export function eventsText(events: readonly EventView[], sinceMs: number): string {
  if (events.length === 0) return 'none';
  return events.map((event) => {
    const offset = `${event.at < sinceMs ? '-' : '+'}${seconds(Math.abs(event.at - sinceMs))}`;
    return `${event.type} (${offset}${event.reason === undefined ? '' : `, ${event.reason}`})`;
  }).join(', ');
}
