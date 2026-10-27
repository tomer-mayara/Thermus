import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { describe, test, type TestContext } from 'node:test';
import { postAuditRelay } from '../../../../src/logs/audit/audit-relay-request.ts';

interface Received {
  readonly method: string | undefined;
  readonly path: string | undefined;
  readonly context: string | undefined;
  readonly contentType: string | undefined;
  readonly body: string;
}

type Answer = (response: ServerResponse) => void;

// A loopback stand-in for the relay route of the control plane. It answers each request with the answer of the test.
async function controlPlaneWith(t: TestContext, answer: Answer) {
  const received: Received[] = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    received.push({ method: request.method, path: request.url, context: request.headers['thermus-access'] as string | undefined, contentType: request.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') });
    answer(response);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; });
  return { received, target: new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/internal/audit`) };
}

const body = JSON.stringify({ eventName: 'mcp.tool.completed', organizationId: 'workos:client_01:org_01A' });

describe('One relay of an audit event', () => {
  test('Given an event and the context of its request, when the tenant relays it, then the control plane gets one POST to /internal/audit with the context, the JSON type, and the event, and 202 gives accepted', async (t) => {
    const controlPlane = await controlPlaneWith(t, (response) => response.writeHead(202).end());

    const outcome = await postAuditRelay({ target: controlPlane.target, context: 'context-of-request-a', body }, new AbortController().signal);

    assert.deepEqual(outcome, { kind: 'accepted' });
    assert.deepEqual(controlPlane.received, [{ method: 'POST', path: '/internal/audit', context: 'context-of-request-a', contentType: 'application/json', body }]);
  });

  const transient: ReadonlyArray<[number, Readonly<Record<string, string>>, Record<string, unknown>]> = [
    [503, { 'Retry-After': '2' }, { kind: 'transient_failure', reason: 'http_status', statusCode: 503, retryAfterMs: 2_000 }],
    [429, {}, { kind: 'transient_failure', reason: 'http_status', statusCode: 429 }],
    [502, {}, { kind: 'transient_failure', reason: 'http_status', statusCode: 502 }],
    [504, {}, { kind: 'transient_failure', reason: 'http_status', statusCode: 504 }],
  ];
  for (const [status, headers, expected] of transient) {
    test(`Given a control plane that answers ${status}, when the tenant relays an event, then the outcome is a transient failure that the sink can retry`, async (t) => {
      const controlPlane = await controlPlaneWith(t, (response) => response.writeHead(status, headers).end());

      assert.deepEqual(await postAuditRelay({ target: controlPlane.target, context: 'context-a', body }, new AbortController().signal), expected);
    });
  }

  for (const status of [400, 403, 404, 413, 500, 302]) {
    test(`Given a control plane that answers ${status}, when the tenant relays an event, then the outcome is a final failure and no redirect is followed`, async (t) => {
      const controlPlane = await controlPlaneWith(t, (response) => response.writeHead(status, { Location: '/elsewhere' }).end());

      assert.deepEqual(await postAuditRelay({ target: controlPlane.target, context: 'context-a', body }, new AbortController().signal), { kind: 'permanent_failure', reason: 'http_status', statusCode: status });
      assert.equal(controlPlane.received.length, 1);
    });
  }

  test('Given a control plane that does not answer, when the time limit of the relay ends, then the outcome is a transient timeout', async (t) => {
    const controlPlane = await controlPlaneWith(t, () => {});

    assert.deepEqual(await postAuditRelay({ target: controlPlane.target, context: 'context-a', body }, new AbortController().signal, 50), { kind: 'transient_failure', reason: 'timeout' });
  });

  test('Given a relay that the sink aborts, when the control plane has not answered, then the outcome is cancelled', async (t) => {
    const controlPlane = await controlPlaneWith(t, () => {});
    const abort = new AbortController();

    const outcome = postAuditRelay({ target: controlPlane.target, context: 'context-a', body }, abort.signal);
    while (controlPlane.received.length === 0) await new Promise<void>((resolve) => setImmediate(resolve));
    abort.abort();

    assert.deepEqual(await outcome, { kind: 'cancelled' });
  });

  test('Given a control plane that refuses the connection, when the tenant relays an event, then the outcome is a transient transport failure', async (t) => {
    const controlPlane = await controlPlaneWith(t, (response) => response.writeHead(202).end());
    const closed = new URL(controlPlane.target);
    closed.port = String(await refusedPort());

    assert.deepEqual(await postAuditRelay({ target: closed, context: 'context-a', body }, new AbortController().signal), { kind: 'transient_failure', reason: 'transport' });
  });
});

async function refusedPort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  server.close();
  await once(server, 'close');
  return port;
}
