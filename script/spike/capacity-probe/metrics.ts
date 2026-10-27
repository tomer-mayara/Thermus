import type { Call } from '../render-tenant-lifecycle/calls.ts';
import { seconds } from '../render-tenant-lifecycle/context.ts';
import { sleep } from '../render-tenant-lifecycle/polls.ts';
import type { RenderClient } from '../render-tenant-lifecycle/render-client.ts';

// Render refuses a resolutionSeconds below 30 with 400, and an epoch number for startTime or endTime with 400
// ("could not parse input"), although the OpenAPI document calls them "Epoch/Unix timestamp". The probe sends ISO 8601.
export const RESOLUTION_SECONDS = 30;
// Render places the points of a read at start + k × resolution, so a read that ends now gives a point at now. Reads
// with starts 10 s apart give other points of the same series: the peak of a window is the largest of three reads.
export const SHIFTS_SECONDS: readonly number[] = [0, 10, 20];
export const SETTLE = { everyMs: 10_000, stableReads: 3, attempts: 18 } as const;
export type MetricName = 'memory' | 'memory-limit' | 'cpu' | 'instance-count';

export interface MetricsReader {
  readonly client: RenderClient;
  readonly signal: AbortSignal;
}

export interface Range {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface MetricQuery {
  readonly metric: MetricName;
  readonly serviceId: string;
  readonly range: Range;
  readonly resolution?: number;
}

interface Point {
  readonly at: number;
  readonly value: number;
}

export interface Series {
  readonly labels: Readonly<Record<string, string>>;
  readonly unit: string;
  readonly points: readonly Point[];
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timeText(epochSeconds: number): string {
  return new Date(epochSeconds * 1_000).toISOString();
}

// The CPU read gives the maximum of the series of the service; memory has no aggregation in the OpenAPI document.
export function metricCall(query: MetricQuery): Call {
  const { range } = query;
  const parameters = new URLSearchParams({
    resource: query.serviceId, startTime: timeText(range.startSeconds), endTime: timeText(range.endSeconds),
    resolutionSeconds: String(query.resolution ?? RESOLUTION_SECONDS),
  });
  if (query.metric === 'cpu') parameters.set('aggregationMethod', 'MAX');
  return { method: 'GET', path: `/metrics/${query.metric}?${parameters}` };
}

function pointsOf(values: unknown): readonly Point[] {
  const items = Array.isArray(values) ? values.filter(isJson) : [];
  const points = items.map((item) => ({ at: Date.parse(String(item.timestamp)), value: Number(item.value) }));
  return points.filter((point) => Number.isFinite(point.at) && Number.isFinite(point.value)).sort((a, b) => a.at - b.at);
}

export function seriesOf(value: unknown): readonly Series[] {
  const items = Array.isArray(value) ? value.filter(isJson) : [];
  return items.map((item) => {
    const labels = Array.isArray(item.labels) ? item.labels.filter(isJson) : [];
    return {
      labels: Object.fromEntries(labels.map((label) => [String(label.field), String(label.value)])),
      unit: typeof item.unit === 'string' ? item.unit : 'no unit',
      points: pointsOf(item.values),
    };
  });
}

export async function readMetric(reader: MetricsReader, query: MetricQuery): Promise<readonly Series[]> {
  return seriesOf((await reader.client.read(metricCall(query), reader.signal)).json);
}

// The series of the three reads with shifted starts, together.
export async function windowSeries(reader: MetricsReader, query: MetricQuery): Promise<readonly Series[]> {
  const { range } = query;
  const shifted = SHIFTS_SECONDS.map((shift) => ({ ...query, range: { startSeconds: range.startSeconds + shift, endSeconds: range.endSeconds + shift } }));
  const parts: (readonly Series[])[] = [];
  for (const part of shifted) parts.push(await readMetric(reader, part));
  return parts.flat();
}

export function peakOf(series: readonly Series[]): { readonly value: number; readonly at: number; readonly unit: string } | undefined {
  let best: { value: number; at: number; unit: string } | undefined;
  for (const item of series) {
    for (const point of item.points) if (best === undefined || point.value > best.value) best = { value: point.value, at: point.at, unit: item.unit };
  }
  return best;
}

// A memory value in bytes is shown in MiB too. Each other unit is shown as Render gives it.
export function quantity(peak: { readonly value: number; readonly unit: string } | undefined): string {
  if (peak === undefined) return 'no point';
  if (/^(b|bytes?)$/i.test(peak.unit)) return `${Math.round(peak.value).toLocaleString('en-US')} bytes (${(peak.value / 1_048_576).toFixed(0)} MiB)`;
  return `${Number(peak.value.toPrecision(4))} ${peak.unit}`;
}

// The buckets of a window: from the bucket of its start to the bucket after the bucket of its end.
export function windowRange(window: { readonly startMs: number; readonly endMs: number }): Range {
  const bucket = (ms: number): number => Math.floor(ms / 1_000 / RESOLUTION_SECONDS) * RESOLUTION_SECONDS;
  return { startSeconds: bucket(window.startMs), endSeconds: bucket(window.endMs) + RESOLUTION_SECONDS };
}

export interface Settled {
  readonly series: readonly Series[];
  readonly final: boolean;
  readonly lagMs: number;
  readonly reads: number;
}

// The memory values of the window are final when 3 reads, 10 s apart, after the shifted ranges have ended give the
// same values. The lag is the time from the window end to the first of those reads.
export async function settledMemory(reader: MetricsReader, serviceId: string, window: { readonly startMs: number; readonly endMs: number }): Promise<Settled> {
  const range = windowRange(window);
  const closed = (range.endSeconds + Math.max(...SHIFTS_SECONDS)) * 1_000 + 2_000;
  if (Date.now() < closed) await sleep(closed - Date.now(), reader.signal);
  let previous = '';
  let firstSeen = Date.now();
  let same = 0;
  let series: readonly Series[] = [];
  for (let reads = 1; reads <= SETTLE.attempts; reads++) {
    series = await windowSeries(reader, { metric: 'memory', serviceId, range });
    const values = JSON.stringify(series.map((item) => item.points));
    if (values === previous) same += 1;
    else [previous, firstSeen, same] = [values, Date.now(), 1];
    if (same >= SETTLE.stableReads) return { series, final: true, lagMs: firstSeen - window.endMs, reads };
    await sleep(SETTLE.everyMs, reader.signal);
  }
  return { series, final: false, lagMs: Date.now() - window.endMs, reads: SETTLE.attempts };
}

export function lagText(settled: Settled): string {
  const text = `${seconds(settled.lagMs)} (${settled.reads} reads)`;
  return settled.final ? text : `not final after ${text}`;
}
