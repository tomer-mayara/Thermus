import assert from 'node:assert/strict';
import type { Client } from '@modelcontextprotocol/client';
import { samePlan } from '../render-tenant-lifecycle/answers.ts';
import { progress, seconds, serviceIdOf, shown } from '../render-tenant-lifecycle/context.ts';
import { sleep } from '../render-tenant-lifecycle/polls.ts';
import { readService } from '../render-tenant-lifecycle/waits.ts';
import { originOf, sessionOf, type CallRecord, type ProbeContext, type WindowRecord } from './context.ts';
import { eventsSince, eventsText, KILL_TYPE, type EventView } from './events.ts';
import type { Workload } from './inputs.ts';
import { connectTenant, errorOutcome, timedCall, workloadCall, type CallOutcome } from './mcp.ts';
import { lagText, peakOf, quantity, readMetric, RESOLUTION_SECONDS, settledMemory, windowRange, type MetricName } from './metrics.ts';
import { waitHealthy, type Health } from './services.ts';
import { baseUrlOf } from './variables.ts';

// Two buckets between the end of a window and the start of the next, so that their metrics do not overlap.
const WINDOW_GAP_MS = 2 * RESOLUTION_SECONDS * 1_000;

interface Window {
  readonly plan: string;
  readonly parallelism: number;
  readonly workload: Workload;
}

interface Sent {
  readonly startMs: number;
  readonly endMs: number;
  readonly outcomes: readonly CallOutcome[];
}

async function pauseAfterLastWindow(context: ProbeContext): Promise<void> {
  const last = context.state.lastWindowEnd;
  const wait = last === undefined ? 0 : last + WINDOW_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait, context.signal);
}

// The clients connect first, so that the tool calls leave at the same time. A failed connect is the outcome of its call.
async function sendCalls(context: ProbeContext, window: Window): Promise<Sent> {
  const tokens = context.state.tokens;
  assert.ok(tokens !== undefined, 'No Connect token: the setup did not finish.');
  await tokens.token();
  const endpoint = new URL('mcp', baseUrlOf(originOf(context, 'tenant')));
  const call = workloadCall(window.workload, originOf(context, 'pages'));
  const connected = await Promise.all(Array.from({ length: window.parallelism }, () => connectTenant(endpoint, tokens).catch((error: unknown) => errorOutcome(error))));
  const startMs = Date.now();
  try {
    const outcomes = await Promise.all(connected.map((client) => (typeof client === 'string'
      ? Promise.resolve({ outcome: `connect ${client}`, ok: false, ms: 0, chars: 0 })
      : timedCall(client, call, context.signal))));
    return { startMs, endMs: Date.now(), outcomes };
  } finally {
    await Promise.allSettled(connected.filter((client): client is Client => typeof client !== 'string').map((client) => client.close()));
  }
}

function transportFailed(outcomes: readonly CallOutcome[]): boolean {
  return outcomes.some((item) => /^(HTTP|network|client|connect)/.test(item.outcome));
}

interface RecoveryFacts {
  readonly events: readonly EventView[];
  readonly sent: Sent;
  // Started at the window end after a transport failure, while the metrics settle. An abort gives its error.
  readonly early?: Promise<Health | Error>;
}

// After a kill or a transport failure, the next window waits until the service answers again.
async function recovery(context: ProbeContext, facts: RecoveryFacts): Promise<string> {
  const killed = facts.events.find((event) => event.type === KILL_TYPE);
  if (killed === undefined && facts.early === undefined) return 'none';
  const health = await (facts.early ?? waitHealthy(context, 'tenant'));
  if (health instanceof Error) throw health;
  assert.ok(health.ok, `The tenant service did not answer again: ${health.text}`);
  const from = killed === undefined ? { at: facts.sent.endMs, what: 'the window end' } : { at: killed.at, what: 'the server_failed event' };
  return `/healthz 200 ${seconds(health.at - from.at)} after ${from.what}`;
}

async function peakText(context: ProbeContext, metric: MetricName, range: ReturnType<typeof windowRange>): Promise<string> {
  const serviceId = serviceIdOf(sessionOf(context, 'tenant'));
  return quantity(peakOf(await readMetric(context, { metric, serviceId, range })));
}

async function measure(context: ProbeContext, window: Window, sent: Sent): Promise<WindowRecord> {
  const serviceId = serviceIdOf(sessionOf(context, 'tenant'));
  const early = transportFailed(sent.outcomes) ? waitHealthy(context, 'tenant').catch((error: unknown) => (error instanceof Error ? error : new Error(String(error)))) : undefined;
  const settled = await settledMemory(context, serviceId, sent);
  const range = windowRange(sent);
  const events = await eventsSince(context, serviceId, sent.startMs);
  const calls: CallRecord[] = sent.outcomes.map((outcome, index) => ({ index: index + 1, ...outcome }));
  return {
    ...window, start: new Date(sent.startMs).toISOString(), calls, memory: quantity(peakOf(settled.series)),
    limit: await peakText(context, 'memory-limit', range), cpu: await peakText(context, 'cpu', range), instances: await peakText(context, 'instance-count', range),
    lag: lagText(settled), kills: events.filter((event) => event.type === KILL_TYPE).length, restart: await recovery(context, { events, sent, early }),
    events: eventsText(events, sent.startMs),
  };
}

function outcomeSummary(calls: readonly CallRecord[]): string {
  const counts = new Map<string, number>();
  for (const call of calls) counts.set(call.outcome, (counts.get(call.outcome) ?? 0) + 1);
  return [...counts].map(([outcome, count]) => `${count} ${outcome}`).join(', ');
}

async function runWindow(context: ProbeContext, window: Window): Promise<WindowRecord> {
  await pauseAfterLastWindow(context);
  progress(`window ${window.plan}, ${window.parallelism} at the same time, ${window.workload}`);
  const sent = await sendCalls(context, window);
  context.state.lastWindowEnd = sent.endMs;
  const record = await measure(context, window, sent);
  context.report.windows.push(record);
  progress(`window ${window.plan}, ${window.parallelism}, ${window.workload}: ${outcomeSummary(record.calls)}; memory ${record.memory}; kills ${record.kills}`);
  return record;
}

export function firstKilled(windows: readonly WindowRecord[], plan: string): number | undefined {
  const killed = windows.filter((item) => item.plan === plan && item.kills > 0).map((item) => item.parallelism);
  return killed.length === 0 ? undefined : Math.min(...killed);
}

// Each parallelism, then each workload, in the order of the inputs. A kill does not stop the step; a service that does
// not answer again does.
export async function callsOn(context: ProbeContext, plan: string): Promise<string> {
  const service = await readService(sessionOf(context, 'tenant'));
  assert.ok(samePlan(service.plan, plan), `The tenant service is on ${shown(service.plan)}, not ${plan}`);
  const records: WindowRecord[] = [];
  for (const parallelism of context.inputs.parallelism) {
    for (const workload of context.inputs.workloads) records.push(await runWindow(context, { plan, parallelism, workload }));
  }
  const kills = records.reduce((sum, item) => sum + item.kills, 0);
  const first = firstKilled(records, plan);
  return `${records.length} windows on ${plan}; ${kills} server_failed events; ${first === undefined ? 'no window was killed' : `the first killed parallelism is ${first}`}.`;
}
