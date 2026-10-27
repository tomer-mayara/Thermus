import assert from 'node:assert/strict';
import type { Client } from '@modelcontextprotocol/client';
import { timedCall, type CallRun } from './client.ts';
import type { Proxy } from './proxy.ts';
import { ABORT_AFTER_MS, ABORT_LIMIT_MS, ms, waitFor } from './steps.ts';
import { TICK_MS, TICKS, type SlowCall, type Upstream } from './upstream.ts';
import type { WireRequest, WireTap } from './wire-tap.ts';

const CALL_END_WAIT_MS = TICKS * TICK_MS + 1_000;
const DROPPED_PROGRESS = 'Received a progress notification for an unknown token';
const DROPPED_RESULT = 'Received a response for an unknown message ID';

export type ProxyExchange = Proxy['exchanges'][number];
export interface Wire { readonly client: Client; readonly tap: WireTap; readonly upstream: Upstream; readonly proxy: Proxy }
export interface Dropped { readonly progress: number; readonly results: number }
export interface CancelMeasure {
  readonly run: CallRun;
  readonly abortAt: number;
  readonly settledAt: number;
  readonly call: SlowCall;
  readonly sent: WireRequest;
  readonly afterAbort: readonly WireRequest[];
  readonly answer: ProxyExchange;
}

export async function measureCancel(wire: Wire, label: string): Promise<CancelMeasure> {
  const first = wire.tap.requests.length;
  const run = await timedCall(wire.client, label, ABORT_AFTER_MS);
  const settledAt = performance.now();
  const { abortAt } = run;
  assert.ok(abortAt !== undefined && run.error !== undefined, 'The aborted call must fail at the client');
  assert.ok(settledAt - abortAt <= ABORT_LIMIT_MS, `The call settled ${ms(settledAt - abortAt)} after the abort; the limit is ${ABORT_LIMIT_MS} ms`);
  const call = await waitFor(() => endedCall(wire.upstream.calls.get(label)), CALL_END_WAIT_MS, 'the upstream handler to end');
  const [sent, ...later] = wire.tap.requests.slice(first);
  assert.equal(sent?.message?.method, 'tools/call', 'The client must send the call as its first request');
  await waitFor(() => sent.streamEnd, 1_000, 'the stream of the call to end at the client');
  const answer = await waitFor(() => endedAnswer(wire.proxy, sent.sentAt), 1_000, 'the proxy to end the answer of the call');
  return { run, abortAt, settledAt, call, sent, afterAbort: later.filter((request) => request.sentAt >= abortAt), answer };
}

export function droppedAfter(tap: WireTap, after: number): Dropped {
  const later = tap.errors.filter((error) => error.at >= after);
  const count = (start: string): number => later.filter((error) => error.message.startsWith(start)).length;
  return { progress: count(DROPPED_PROGRESS), results: count(DROPPED_RESULT) };
}

export function droppedResult(tap: WireTap, after: number): Dropped | undefined {
  const dropped = droppedAfter(tap, after);
  return dropped.results > 0 ? dropped : undefined;
}

function endedCall(call: SlowCall | undefined): SlowCall | undefined {
  return call?.finishedAt !== undefined || call?.stoppedAt !== undefined ? call : undefined;
}

function endedAnswer(proxy: Proxy, sentAt: number): ProxyExchange | undefined {
  const exchange = proxy.exchanges.find((item) => item.startedAt >= sentAt);
  return exchange?.endedAt !== undefined || exchange?.clientGoneAt !== undefined ? exchange : undefined;
}
