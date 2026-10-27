import assert from 'node:assert/strict';
import { SdkError, type Client } from '@modelcontextprotocol/client';
import { probeContext, signAccess } from './access-context.ts';
import { droppedAfter, droppedResult, measureCancel, type CancelMeasure, type Dropped, type ProxyExchange } from './cancel-measure.ts';
import { connectClient, LEGACY_PROTOCOL_VERSION, newClient, PROTOCOL_VERSION } from './client.ts';
import type { Proxy } from './proxy.ts';
import { ABORT_AFTER_MS, ABORT_LIMIT_MS, messageOf, ms, STOP_LIMIT_MS, waitFor, type Parts, type ProbeStep, type Report, type Row } from './steps.ts';
import { TICK_MS, TICKS, type SlowCall } from './upstream.ts';
import { wireTap, type WireRequest, type WireTap } from './wire-tap.ts';

const STREAM_REFUSED = 'Failed to open SSE stream';

interface Notice { readonly request: WireRequest; readonly requestId: unknown; readonly reason: string; readonly answer: ProxyExchange }
interface Stop { readonly streamClosedAt: number; readonly clientGoneAt: number; readonly signalAt: number; readonly stoppedAt: number }

export async function connectThroughTap(client: Client, proxy: URL, tap: WireTap): Promise<void> {
  client.onerror = (error) => tap.recordError(error);
  await connectClient(client, proxy, tap.fetch);
}

async function handshake(tap: WireTap, { keys, upstream }: Parts, report: Report): Promise<string> {
  const stream = await waitFor(() => tap.requests.find((request) => request.httpMethod === 'GET' && request.status !== undefined), 1_000, 'the answer to the GET stream');
  const refusals = await waitFor(() => streamRefusals(tap), 1_000, 'the client to report the answer to its GET stream');
  const [initialize, initialized] = tap.requests;
  assert.equal(initialize.message?.method, 'initialize', 'The client must start with initialize');
  assert.equal(initialize.message?.params?.protocolVersion, LEGACY_PROTOCOL_VERSION, `The client must offer ${LEGACY_PROTOCOL_VERSION}`);
  assert.equal(initialize.status, 200, `The client got ${String(initialize.status)} for initialize`);
  assert.equal(initialized.message?.method, 'notifications/initialized', 'The client must send notifications/initialized second');
  assert.equal(initialized.status, 202, `The client got ${String(initialized.status)} for notifications/initialized`);
  assert.equal(stream.status, 404, 'The proxy must answer the GET stream with 404, because it forwards only POST');
  const direct = await directGet(upstream.url, signAccess(probeContext(), keys.gateway.privateKey));
  assert.equal(direct, 405, `A direct GET with a signed header got ${direct}, not the 405 of a stateless upstream`);
  const part = 'Handshake';
  report.rows.push(
    { part, event: 'initialize POST through the proxy', expected: `200, version ${LEGACY_PROTOCOL_VERSION}`, measured: `200; offered and negotiated ${LEGACY_PROTOCOL_VERSION}` },
    { part, event: 'notifications/initialized POST', expected: '202', measured: '202' },
    { part, event: 'GET stream after notifications/initialized', expected: '404: the proxy forwards only POST', measured: `404; the client reported "${STREAM_REFUSED}: Not Found" ${refusals} times` },
    { part, event: 'Direct GET to the upstream with a signed header', expected: '405', measured: '405' },
  );
  return `the client negotiated ${LEGACY_PROTOCOL_VERSION} through the proxy with initialize (200) and notifications/initialized (202); the proxy answered its GET stream with 404, and the client reported it ${refusals} times and kept working; a direct GET to the upstream got 405.`;
}

async function cancelByNotification(tap: WireTap, { client, upstream, proxy }: Parts, report: Report): Promise<string> {
  const serversBefore = upstream.stats.mcpRequests;
  const measure = await measureCancel({ client, tap, upstream, proxy }, 'notification-cancel');
  const notice = noticeOf(measure, proxy);
  assert.equal(upstream.stats.mcpRequests - serversBefore, 2, 'The upstream must make one server for the call and one for the notification');
  const finishedAt = ranToItsEndAt(measure);
  const dropped = await waitFor(() => droppedResult(tap, measure.abortAt), 1_000, 'the client to drop the result of the call');
  assert.equal(dropped.progress, TICKS - measure.run.progressAt.length, 'The client must drop each progress notification after the abort');
  report.rows.push(...notificationRows(measure, notice, dropped));
  return `on the abort, the client sent one notifications/cancelled POST for request ${String(notice.requestId)} and settled its call ${ms(measure.settledAt - measure.abortAt)} later; the proxy forwarded it, and a new upstream server answered 202; the running handler saw no signal and ran to its end at ${ms(finishedAt - measure.run.startedAt)}; the proxy sent the whole answer, and the client dropped ${dropped.progress} progress notifications and the result.`;
}

async function contrast({ upstream, proxy }: Parts, report: Report): Promise<string> {
  const tap = wireTap();
  const client = newClient();
  try {
    await connectThroughTap(client, proxy.url, tap);
    assert.equal(client.getNegotiatedProtocolVersion(), PROTOCOL_VERSION, `The contrast client must negotiate ${PROTOCOL_VERSION}`);
    const measure = await measureCancel({ client, tap, upstream, proxy }, 'stream-close');
    assert.deepEqual(measure.afterAbort, [], `The ${PROTOCOL_VERSION} client must send no request on the abort`);
    const stop = stoppedAtTheAbort(measure);
    assert.deepEqual(droppedAfter(tap, measure.abortAt), { progress: 0, results: 0 }, `The ${PROTOCOL_VERSION} client must drop no message after the abort`);
    report.rows.push(...contrastRows(measure, stop));
    return `the ${PROTOCOL_VERSION} client sent no request on the abort and closed the stream of the call; the upstream handler saw its signal ${ms(stop.signalAt - measure.abortAt)} after the abort and stopped.`;
  } finally {
    await client.close();
  }
}

function noticeOf({ sent, afterAbort }: CancelMeasure, proxy: Proxy): Notice {
  assert.equal(afterAbort.length, 1, `The client must send one request on the abort, not ${afterAbort.length}`);
  const [request] = afterAbort;
  const { requestId, reason } = cancelledParams(request, sent);
  assert.equal(request.status, 202, `The client got ${String(request.status)} for the notification`);
  const answer = proxy.exchanges.find((exchange) => exchange.startedAt >= request.sentAt);
  assert.ok(answer?.status === 202, 'The proxy must forward the notification and get 202 from the upstream');
  return { request, requestId, reason, answer };
}

function cancelledParams({ message }: WireRequest, call: WireRequest): Pick<Notice, 'requestId' | 'reason'> {
  assert.equal(message?.method, 'notifications/cancelled', `The client sent ${String(message?.method)} on the abort`);
  const params: { readonly [key: string]: unknown } = message?.params ?? {};
  assert.equal(params.requestId, call.message?.id, 'The notification must name the request id of the call');
  assert.ok(typeof params.reason === 'string', 'The notification must carry a reason');
  return { requestId: params.requestId, reason: params.reason };
}

function ranToItsEndAt({ call, abortAt, sent, answer }: CancelMeasure): number {
  const { signalAt, finishedAt } = call;
  assert.ok(signalAt === undefined || (finishedAt !== undefined && signalAt >= finishedAt), `The upstream handler saw its signal ${ms((signalAt ?? abortAt) - abortAt)} after the abort, while it ran`);
  assert.ok(finishedAt !== undefined && call.stoppedAt === undefined, 'The upstream handler must run to its end');
  assert.equal(call.progressSentAt.length, TICKS, `The upstream handler must send ${TICKS} progress notifications`);
  assert.ok(sent.streamEnd?.how === 'ended', `The stream of the call must stay open until its end; it was ${String(sent.streamEnd?.how)}`);
  assert.ok(sent.streamEnd.at > finishedAt, 'The stream of the call ended before the handler finished');
  assert.equal(answer.clientGoneAt, undefined, 'The proxy must not see the client go');
  return finishedAt;
}

function stoppedAtTheAbort({ call, abortAt, sent, answer }: CancelMeasure): Stop {
  const { signalAt, stoppedAt } = call;
  assert.ok(sent.streamEnd?.how === 'aborted', `The client must close the stream of the call on the abort; it was ${String(sent.streamEnd?.how)}`);
  assert.ok(answer.clientGoneAt !== undefined, 'The proxy must see the client go');
  assert.ok(signalAt !== undefined && signalAt - abortAt <= ABORT_LIMIT_MS, `The upstream signal must fire within ${ABORT_LIMIT_MS} ms of the abort`);
  assert.ok(stoppedAt !== undefined && stoppedAt - signalAt <= STOP_LIMIT_MS, `The upstream handler must stop within ${STOP_LIMIT_MS} ms of its signal`);
  assert.ok(call.progressSentAt.every((at) => at < abortAt), 'The handler must send no progress after the abort');
  return { streamClosedAt: sent.streamEnd.at, clientGoneAt: answer.clientGoneAt, signalAt, stoppedAt };
}

function notificationRows(measure: CancelMeasure, notice: Notice, dropped: Dropped): Row[] {
  const part = 'Cancel by notification';
  const { run, abortAt, call, sent, answer } = measure;
  const after = (at: number | undefined): string => (at === undefined ? 'unknown' : `+${ms(at - abortAt)}`);
  const since = (at: number | undefined): string => (at === undefined ? 'unknown' : ms(at - run.startedAt));
  return [
    ...openingRows(part, measure),
    { part, event: 'Request on the abort', expected: 'notifications/cancelled POST', measured: `POST at ${after(notice.request.sentAt)}: notifications/cancelled, requestId ${String(notice.requestId)} (the id of the call), reason "${notice.reason}"` },
    { part, event: 'Answer to that POST', expected: '202 from a new upstream server', measured: `202 at ${after(notice.request.answeredAt)}; the upstream factory made a server for it` },
    settleRow(part, measure),
    { part, event: 'Stream of the call at the client', expected: 'stays open', measured: `open; it ended at ${since(sent.streamEnd?.at)}, after the result` },
    { part, event: 'Proxy sees the client go (response close)', expected: 'not seen', measured: `not seen; the proxy ended the answer at ${since(answer.endedAt)}` },
    { part, event: 'Upstream handler signal', expected: 'none while it runs', measured: signalAfterTheEnd(call) },
    { part, event: 'Upstream handler end', expected: 'runs to its end', measured: `finished at ${since(call.finishedAt)}, after ${call.progressSentAt.length} of ${TICKS} progress notifications` },
    { part, event: 'Messages the client drops after the abort', expected: `${TICKS - run.progressAt.length} progress notifications and the result`, measured: `${dropped.progress} progress notifications and ${dropped.results} result` },
  ];
}

function contrastRows(measure: CancelMeasure, stop: Stop): Row[] {
  const part = `Contrast ${PROTOCOL_VERSION}`;
  const after = (at: number): string => `+${ms(at - measure.abortAt)}`;
  return [
    ...openingRows(part, measure),
    { part, event: 'Request on the abort', expected: 'none; the client closes the stream of the call', measured: 'none' },
    settleRow(part, measure),
    { part, event: 'Stream of the call at the client', expected: 'closed at the abort', measured: `closed (aborted) at ${after(stop.streamClosedAt)}` },
    { part, event: 'Proxy sees the client go (response close)', expected: 'after the abort', measured: after(stop.clientGoneAt) },
    { part, event: 'Upstream handler signal', expected: `within ${ABORT_LIMIT_MS} ms of the abort`, measured: after(stop.signalAt) },
    { part, event: 'Upstream handler end', expected: `stops within ${STOP_LIMIT_MS} ms of its signal`, measured: `stopped at ${after(stop.stoppedAt)}, after ${measure.call.progressSentAt.length} of ${TICKS} progress notifications` },
    { part, event: 'Messages the client drops after the abort', expected: 'none', measured: '0' },
  ];
}

function openingRows(part: string, { run, abortAt }: CancelMeasure): Row[] {
  return [
    { part, event: 'Client abort', expected: `about ${ABORT_AFTER_MS} ms`, measured: ms(abortAt - run.startedAt) },
    { part, event: 'Progress received before the abort', expected: `${Math.floor(ABORT_AFTER_MS / TICK_MS)}`, measured: `${run.progressAt.length}` },
  ];
}

function settleRow(part: string, { run, abortAt, settledAt }: CancelMeasure): Row {
  return { part, event: 'Client call settles', expected: 'at the abort, with an error', measured: `+${ms(settledAt - abortAt)}: ${errorText(run.error)}` };
}

// The SDK closes the per-request server when the answer stream ends, and the close aborts the signal of a handler
// that has finished but is still registered.
function signalAfterTheEnd({ signalAt, finishedAt }: SlowCall): string {
  if (signalAt === undefined) return 'none';
  return `none while it ran; it fired ${ms(signalAt - (finishedAt ?? signalAt))} after its end, when the SDK closed its server`;
}

function streamRefusals(tap: WireTap): number | undefined {
  const count = tap.errors.filter((error) => error.message.startsWith(STREAM_REFUSED)).length;
  return count > 0 ? count : undefined;
}

async function directGet(upstream: URL, access: string): Promise<number> {
  const headers = { accept: 'text/event-stream', 'mcp-protocol-version': LEGACY_PROTOCOL_VERSION, 'thermus-access': access };
  const response = await fetch(new URL('/mcp', upstream), { headers });
  await response.text();
  return response.status;
}

function errorText(error: unknown): string {
  return error instanceof SdkError ? `SdkError ${error.code} "${error.message}"` : messageOf(error);
}

export function notificationSteps(tap: WireTap): readonly ProbeStep[] {
  return [
    {
      name: 'Handshake',
      spec: `Given the three parts with the client pinned to ${LEGACY_PROTOCOL_VERSION}, when it connects, then initialize and notifications/initialized pass the proxy, and the proxy answers its GET stream with 404.`,
      run: (parts, report) => handshake(tap, parts, report),
    },
    {
      name: 'Cancel by notification',
      spec: `Given a slow call of that client, when the client aborts it after ${ABORT_AFTER_MS} ms, then it sends a notifications/cancelled POST that gets 202, and the upstream handler sees no signal and runs to its end.`,
      run: (parts, report) => cancelByNotification(tap, parts, report),
    },
    {
      name: `Contrast ${PROTOCOL_VERSION}`,
      spec: `Given a second client pinned to ${PROTOCOL_VERSION}, when it aborts a slow call after ${ABORT_AFTER_MS} ms, then it sends no request, and the upstream handler sees its signal within ${ABORT_LIMIT_MS} ms.`,
      run: contrast,
    },
  ];
}
