import assert from 'node:assert/strict';
import type { KeyObject } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Client } from '@modelcontextprotocol/client';
import { ORGANIZATION_ID, probeContext, signAccess, type Refusal } from './access-context.ts';
import { BEARER_TOKEN, directRequest, FORGED_ACCESS, PROBE_HOP_HEADERS, timedCall } from './client.ts';
import type { Proxy } from './proxy.ts';
import { TICK_MS, TICKS, type SlowCall, type Upstream } from './upstream.ts';

// A buffered answer delivers every notification at about 3000 ms; a streamed answer delivers each one near its tick.
const ARRIVAL_SLACK_MS = 250;
const ABORT_AFTER_MS = 500;
const EARLY_ABORT_AFTER_MS = 50;
const ABORT_LIMIT_MS = 100;
const STOP_LIMIT_MS = 20;
const RESULT_TEXT = `slow finished for ${ORGANIZATION_ID}`;

interface Keys { readonly gateway: { readonly privateKey: KeyObject }; readonly other: { readonly privateKey: KeyObject } }
export interface Parts { readonly keys: Keys; readonly upstream: Upstream; readonly proxy: Proxy; readonly client: Client }
interface Row { readonly part: string; readonly event: string; readonly expected: string; readonly measured: string }
export interface Report { readonly rows: Row[]; readonly conclusions: string[] }
export interface ProbeStep { readonly name: string; readonly spec: string; run(parts: Parts, report: Report): Promise<string> }
type StoppedCall = SlowCall & { readonly signalAt: number; readonly stoppedAt: number };
type Exchange = Proxy['exchanges'][number] & { readonly clientGoneAt: number };
interface AbortMeasure { readonly startedAt: number; readonly abortAt: number; readonly progress: number; readonly call: StoppedCall; readonly exchange: Exchange }

async function streaming({ client, upstream }: Parts, report: Report): Promise<string> {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name), ['slow'], 'The upstream must list exactly the tool slow');
  const run = await timedCall(client, 'stream');
  assert.equal(run.error, undefined, `The call through the proxy failed: ${messageOf(run.error)}`);
  assert.ok(run.resultAt !== undefined);
  assert.equal(run.text, RESULT_TEXT, 'The result must name the organization of the verified context');
  assert.equal(run.progressAt.length, TICKS, `The client must receive ${TICKS} progress notifications`);
  const sent = upstream.calls.get('stream')?.progressSentAt ?? [];
  for (const [index, arrivedAt] of run.progressAt.entries()) {
    const planned = (index + 1) * TICK_MS;
    const elapsed = arrivedAt - run.startedAt;
    assert.ok(arrivedAt < run.resultAt, `Progress ${index + 1} arrived after the result`);
    assert.ok(elapsed <= planned + ARRIVAL_SLACK_MS, `Progress ${index + 1} arrived at ${ms(elapsed)}, after ${planned + ARRIVAL_SLACK_MS} ms: the answer was buffered`);
    const sentAt = sent[index] === undefined ? 'unknown' : ms(sent[index] - run.startedAt);
    report.rows.push({ part: 'Streaming', event: `Progress ${index + 1} received`, expected: `about ${planned} ms`, measured: `${ms(elapsed)} (sent ${sentAt})` });
  }
  const resultAt = run.resultAt - run.startedAt;
  assert.ok(resultAt >= TICKS * TICK_MS, `The result arrived at ${ms(resultAt)}, before the tool could finish`);
  report.rows.push({ part: 'Streaming', event: 'Result received', expected: `after progress ${TICKS}`, measured: ms(resultAt) });
  return `${TICKS} progress notifications arrived before the result, from ${ms(run.progressAt[0] - run.startedAt)} to ${ms(run.progressAt[TICKS - 1] - run.startedAt)}; the result came at ${ms(resultAt)}.`;
}

async function headers({ upstream }: Parts, report: Report): Promise<string> {
  assert.ok(upstream.accepted.length > 0, 'The upstream must accept the requests of the proxy');
  for (const { headers: received, context } of upstream.accepted) {
    assert.equal(received.get('authorization'), `Bearer ${BEARER_TOKEN}`, 'The proxy must forward the bearer token');
    for (const name of PROBE_HOP_HEADERS) assert.equal(received.get(name), null, `The proxy forwarded the hop-by-hop header ${name}`);
    assert.notEqual(received.get('thermus-access'), FORGED_ACCESS, 'The proxy forwarded the Thermus-Access value of the client');
    assert.equal(context.organizationId, ORGANIZATION_ID, 'The upstream must verify the context that the proxy signed');
  }
  const methods = upstream.accepted.map(({ headers: received }) => received.get('mcp-method') ?? 'unknown').join(', ');
  const count = `${upstream.accepted.length} of ${upstream.accepted.length} requests`;
  report.rows.push(
    { part: 'Headers', event: 'Bearer token at the upstream', expected: 'forwarded', measured: `forwarded in ${count} (${methods})` },
    { part: 'Headers', event: 'TE, Trailer, and Proxy-Probe at the upstream', expected: 'removed', measured: `removed in ${count}` },
    { part: 'Headers', event: 'Thermus-Access value of the client', expected: 'replaced', measured: `replaced in ${count}` },
  );
  return `the bearer token reached the upstream in ${count}; TE, Trailer, and Proxy-* did not; the proxy replaced the Thermus-Access value of the client.`;
}

async function measureAbort({ client, upstream, proxy }: Parts, label: string, afterMs: number): Promise<AbortMeasure> {
  const run = await timedCall(client, label, afterMs);
  assert.ok(run.abortAt !== undefined && run.error !== undefined, 'The aborted call must fail at the client');
  const abortAt = run.abortAt;
  const call = await waitFor(() => stoppedCall(upstream.calls.get(label)), 1_000, 'the upstream handler to stop');
  const signalDelay = call.signalAt - abortAt;
  assert.ok(signalDelay >= 0 && signalDelay <= ABORT_LIMIT_MS, `The upstream signal fired ${ms(signalDelay)} after the abort; the limit is ${ABORT_LIMIT_MS} ms`);
  assert.ok(call.stoppedAt - call.signalAt <= STOP_LIMIT_MS, `The upstream handler stopped ${ms(call.stoppedAt - call.signalAt)} after its signal; the limit is ${STOP_LIMIT_MS} ms`);
  assert.equal(call.finishedAt, undefined, 'The aborted handler must not finish');
  assert.ok(call.progressSentAt.every((at) => at < abortAt), 'The handler must send no progress after the abort');
  const exchange = proxy.exchanges.find((item) => item.startedAt >= run.startedAt);
  assert.ok(exchange?.clientGoneAt !== undefined, 'The proxy must see the client go away');
  return { startedAt: run.startedAt, abortAt, progress: run.progressAt.length, call, exchange: { ...exchange, clientGoneAt: exchange.clientGoneAt } };
}

function abortRows(part: string, measure: AbortMeasure, afterMs: number): Row[] {
  const { startedAt, abortAt, call, exchange } = measure;
  return [
    { part, event: 'Client abort', expected: `about ${afterMs} ms`, measured: ms(abortAt - startedAt) },
    { part, event: 'Progress received before the abort', expected: `${Math.floor(afterMs / TICK_MS)}`, measured: `${measure.progress}` },
    { part, event: 'Proxy sees the client go (response close)', expected: 'after the abort', measured: `+${ms(exchange.clientGoneAt - abortAt)}` },
    { part, event: 'Upstream handler signal', expected: `within ${ABORT_LIMIT_MS} ms of the abort`, measured: `+${ms(call.signalAt - abortAt)}` },
    { part, event: 'Upstream handler stops', expected: `within ${STOP_LIMIT_MS} ms of its signal`, measured: `+${ms(call.stoppedAt - abortAt)}` },
  ];
}

async function abort(parts: Parts, report: Report): Promise<string> {
  const measure = await measureAbort(parts, 'abort', ABORT_AFTER_MS);
  assert.equal(measure.exchange.status, 200, 'The abort must come while the answer streams');
  const closedAt = measure.exchange.requestClosedAt;
  report.rows.push(...abortRows('Abort', measure, ABORT_AFTER_MS), {
    part: 'Abort', event: 'Proxy incoming request close event', expected: 'not a client signal',
    measured: closedAt === undefined ? 'not seen' : `${ms(closedAt - measure.startedAt)}, at the body end`,
  });
  return `the upstream handler saw its signal ${ms(measure.call.signalAt - measure.abortAt)} after the client abort (limit ${ABORT_LIMIT_MS} ms) and stopped; the proxy used the close event of its response, because the close event of the incoming request came at the body end.`;
}

async function earlyAbort(parts: Parts, report: Report): Promise<string> {
  const measure = await measureAbort(parts, 'early-abort', EARLY_ABORT_AFTER_MS);
  assert.equal(measure.exchange.status, undefined, 'The early abort must come before the upstream answers');
  report.rows.push(...abortRows('Early abort', measure, EARLY_ABORT_AFTER_MS));
  return `before the upstream answered, the proxy aborted its pending upstream request; the handler saw its signal ${ms(measure.call.signalAt - measure.abortAt)} after the client abort.`;
}

async function signedHeader({ keys, upstream, client }: Parts, report: Report): Promise<string> {
  const before = upstream.stats.mcpRequests;
  const cases: { name: string; header?: string; reason: Refusal }[] = [
    { name: 'no header', reason: 'missing' },
    { name: 'signed by another key pair', header: signAccess(probeContext(), keys.other.privateKey), reason: 'bad_signature' },
    { name: 'expired context', header: signAccess(probeContext(Date.now() - 1_000), keys.gateway.privateKey), reason: 'expired' },
  ];
  for (const item of cases) {
    const answer = await directRequest(upstream.url, item.header);
    assert.equal(answer.status, 403, `A direct request with ${item.name} got ${answer.status}`);
    assert.match(answer.type ?? '', /^application\/json/, `The 403 answer for ${item.name} must be JSON`);
    assert.deepEqual(answer.body, { error: 'access_denied', reason: item.reason }, `The 403 answer for ${item.name} has the wrong reason`);
    report.rows.push({ part: 'Signed header', event: `Direct request, ${item.name}`, expected: '403', measured: `403, reason ${item.reason}` });
  }
  assert.equal(upstream.stats.mcpRequests, before, 'A refused request must not reach MCP handling');
  const run = await timedCall(client, 'signed');
  assert.equal(run.error, undefined, `The call through the proxy failed: ${messageOf(run.error)}`);
  assert.equal(run.text, RESULT_TEXT, 'The result must name the organization of the verified context');
  assert.ok(run.resultAt !== undefined);
  report.rows.push(
    { part: 'Signed header', event: 'MCP handling of the refused requests', expected: 'none', measured: 'none' },
    { part: 'Signed header', event: 'Call through the proxy', expected: 'result', measured: `result at ${ms(run.resultAt - run.startedAt)}` },
  );
  return 'direct requests with no header, another key pair, or an expired context got 403 before MCP handling; the call through the proxy got its result.';
}

async function cleanup({ upstream, proxy }: Parts, report: Report): Promise<string> {
  assert.equal(upstream.server.listening, false, 'The upstream listener is still open');
  assert.equal(proxy.server.listening, false, 'The proxy listener is still open');
  const deadline = performance.now() + 1_000;
  while (tcpHandles().length > 0 && performance.now() < deadline) await delay(10);
  assert.deepEqual(tcpHandles(), [], `Open TCP handles after the close: ${tcpHandles().join(', ')}`);
  report.rows.push({ part: 'Cleanup', event: 'Open listeners and TCP handles', expected: '0', measured: '0' });
  return 'both listeners are closed and no TCP handle is open; a watchdog stops the process with code 1 if it does not exit.';
}

export const partSteps: readonly ProbeStep[] = [
  { name: 'Streaming', spec: 'Given the three parts, when the client lists the tools and calls slow, then the progress notifications arrive before the result.', run: streaming },
  { name: 'Headers', spec: 'Given the requests of that call, when they reach the upstream, then they carry the bearer token and no hop-by-hop or client Thermus-Access value.', run: headers },
  { name: 'Abort', spec: `Given a second slow call, when the client aborts it after ${ABORT_AFTER_MS} ms, then the upstream handler sees its signal within ${ABORT_LIMIT_MS} ms.`, run: abort },
  { name: 'Early abort', spec: `Given another slow call, when the client aborts it after ${EARLY_ABORT_AFTER_MS} ms, before the upstream answers, then the handler sees its signal within ${ABORT_LIMIT_MS} ms.`, run: earlyAbort },
  { name: 'Signed header', spec: 'Given no header, another key pair, or an expired context, when a request reaches the upstream directly, then 403; through the proxy, a result.', run: signedHeader },
];
export const cleanupStep: ProbeStep = { name: 'Cleanup', spec: 'Given the end of the probe, then every listener is closed and no socket keeps the process alive.', run: cleanup };

function stoppedCall(call: SlowCall | undefined): StoppedCall | undefined {
  if (call?.signalAt === undefined || call.stoppedAt === undefined) return undefined;
  return { ...call, signalAt: call.signalAt, stoppedAt: call.stoppedAt };
}

function tcpHandles(): string[] {
  return process.getActiveResourcesInfo().filter((name) => name.startsWith('TCP'));
}

async function waitFor<T>(read: () => T | undefined, timeoutMs: number, what: string): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  for (let value = read(); ; value = read()) {
    if (value !== undefined) return value;
    if (performance.now() > deadline) throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`);
    await delay(5);
  }
}

function ms(value: number): string {
  return `${value.toFixed(1)} ms`;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
