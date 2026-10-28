import type { MemoryRead, MemoryUse, RestartRead, TimeWindow } from '../../tenants/tenant-platform.ts';
import type { RenderApi, RenderClock } from './render-api.ts';
import { reasonOf, sendRepeated, successOf } from './render-exchanges.ts';
import { isServiceId, recordOf } from './render-services.ts';

// One point every 10 minutes keeps the answer of a day small: 144 points for each service. Render does not document how
// a point sums up its 10 minutes, so a peak shorter than that can show lower; the smallest resolution is 30 s (SO-01e).
const RESOLUTION_SECONDS = 600;
const EVENT_PAGE = 100;
const EVENT_PAGES = 10;
// A restart outside a deploy: a failed server, such as a kill for memory, or a restarted one. Render did not report
// each restart of SO-01e as an event, so the count is the restarts that Render reports.
const RESTART_TYPES: ReadonlySet<string> = new Set(['server_failed', 'server_restarted']);

type Peaks = { readonly status: 'found'; readonly peaks: ReadonlyMap<string, number> } | { readonly status: 'unavailable'; readonly reason: string };

interface ListedEvent {
  readonly type: string;
  readonly atMs: number;
  readonly cursor: string;
}

/**
 * The metric and event reads of the tenant platform on Render, with the retry rule of the other reads. The metrics
 * reads have their own limit of 30 a minute (SO-01e), so one read names every service of the summary.
 */
export class RenderMetrics {
  private readonly parts: { readonly api: RenderApi; readonly clock: RenderClock };

  constructor(parts: { readonly api: RenderApi; readonly clock: RenderClock }) {
    this.parts = parts;
  }

  /** The memory peak and the memory limit of each service, from one read of each series for the window. */
  async memoryUse(serviceIds: readonly string[], window: TimeWindow, signal: AbortSignal): Promise<MemoryRead> {
    const ids = serviceIds.filter(isServiceId);
    if (ids.length === 0) return { status: 'found', services: new Map() };
    const query = metricsQuery(ids, window);
    const memory = await this.peaks('memory', query, signal);
    if (memory.status === 'unavailable') return memory;
    const limits = await this.peaks('memory-limit', query, signal);
    if (limits.status === 'unavailable') return limits;
    return { status: 'found', services: memoryUseOf(memory.peaks, limits.peaks) };
  }

  /** The restart events of the service inside the window, from every page of its event list. */
  async restartCount(serviceId: string, window: TimeWindow, signal: AbortSignal): Promise<RestartRead> {
    if (!isServiceId(serviceId)) return { status: 'gone' };
    let restarts = 0;
    let cursor: string | undefined;
    for (let page = 1; page <= EVENT_PAGES; page += 1) {
      const exchange = await sendRepeated(this.parts, { method: 'GET', path: `/services/${serviceId}/events?${eventsQuery(window, cursor)}` }, signal);
      if (exchange.answer?.status === 404) return { status: 'gone' };
      const answer = successOf(exchange);
      if (answer === undefined) return { status: 'unavailable', reason: reasonOf(exchange) };
      const events = eventsOf(answer.json);
      if (events === undefined) return { status: 'unavailable', reason: 'Render answered an invalid event list' };
      restarts += events.filter((event) => RESTART_TYPES.has(event.type) && event.atMs >= window.startMs && event.atMs <= window.endMs).length;
      if (events.length < EVENT_PAGE) return { status: 'found', restarts };
      cursor = events.at(-1)?.cursor;
    }
    return { status: 'unavailable', reason: `Render gave more than ${EVENT_PAGES} pages of events` };
  }

  private async peaks(metric: 'memory' | 'memory-limit', query: string, signal: AbortSignal): Promise<Peaks> {
    const exchange = await sendRepeated(this.parts, { method: 'GET', path: `/metrics/${metric}?${query}` }, signal);
    const answer = successOf(exchange);
    return answer === undefined ? { status: 'unavailable', reason: reasonOf(exchange) } : peaksOf(answer.json);
  }
}

// Render takes ISO 8601 times; an epoch number gets 400 (SO-01e).
function metricsQuery(serviceIds: readonly string[], window: TimeWindow): string {
  const query = new URLSearchParams(serviceIds.map((serviceId): [string, string] => ['resource', serviceId]));
  query.set('startTime', new Date(window.startMs).toISOString());
  query.set('endTime', new Date(window.endMs).toISOString());
  query.set('resolutionSeconds', String(RESOLUTION_SECONDS));
  return query.toString();
}

function eventsQuery(window: TimeWindow, cursor: string | undefined): string {
  const query = new URLSearchParams({ startTime: new Date(window.startMs).toISOString(), endTime: new Date(window.endMs).toISOString(), limit: String(EVENT_PAGE) });
  if (cursor !== undefined) query.set('cursor', cursor);
  return query.toString();
}

// Each series names its service in the label resource (or service) and gives its points in bytes (SO-01e).
function peaksOf(json: unknown): Peaks {
  if (!Array.isArray(json)) return { status: 'unavailable', reason: 'Render answered an invalid metrics list' };
  const peaks = new Map<string, number>();
  for (const series of json.map(recordOf)) {
    const serviceId = serviceOfLabels(series.labels);
    if (serviceId === undefined || !Array.isArray(series.values)) return { status: 'unavailable', reason: 'Render answered an invalid metrics list' };
    if (series.unit !== 'bytes') return { status: 'unavailable', reason: `Render answered memory in the unit ${String(series.unit)}, not bytes` };
    const values = series.values.map((point) => Number(recordOf(point).value)).filter(Number.isFinite);
    if (values.length > 0) peaks.set(serviceId, Math.max(peaks.get(serviceId) ?? 0, ...values));
  }
  return { status: 'found', peaks };
}

function serviceOfLabels(labels: unknown): string | undefined {
  const fields = Array.isArray(labels) ? labels.map(recordOf) : [];
  const label = fields.find((field) => field.field === 'resource') ?? fields.find((field) => field.field === 'service');
  return typeof label?.value === 'string' ? label.value : undefined;
}

function memoryUseOf(memory: ReadonlyMap<string, number>, limits: ReadonlyMap<string, number>): ReadonlyMap<string, MemoryUse> {
  return new Map([...memory].map(([serviceId, peakBytes]) => {
    const limitBytes = limits.get(serviceId);
    return [serviceId, limitBytes === undefined ? { peakBytes } : { peakBytes, limitBytes }];
  }));
}

function eventsOf(json: unknown): readonly ListedEvent[] | undefined {
  if (!Array.isArray(json)) return undefined;
  const events = json.map((item) => {
    const { event, cursor } = recordOf(item);
    const { type, timestamp } = recordOf(event);
    const atMs = typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN;
    return typeof type === 'string' && typeof cursor === 'string' && Number.isFinite(atMs) ? { type, atMs, cursor } : undefined;
  });
  return events.every((event) => event !== undefined) ? events : undefined;
}
