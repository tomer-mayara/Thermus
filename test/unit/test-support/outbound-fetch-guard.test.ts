import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, describe, test, type TestContext } from 'node:test';
import { guardOutboundFetch, outboundFetchGuard, type OutboundFetchGuard } from '../../support/isolation/outbound-fetch-guard.ts';

const refusal = 'Outbound network access is not allowed in this test';
const finding = 'no request left the machine';
const refused = { name: 'Error', message: refusal };

// The release is in a finally block. Thus the test leaves the real fetch in place also when a check in the act fails.
async function whileInstalled(guard: OutboundFetchGuard, act: () => Promise<void>): Promise<unknown> {
  let releaseError: unknown;
  guard.install();
  try {
    await act();
  } finally {
    try {
      guard.release();
    } catch (error) {
      releaseError = error;
    }
  }
  return releaseError;
}

// Node adds a diff after the message of a failed check. Thus the finding is the first line of the message.
function assertFinding(releaseError: unknown, refusedRequests: readonly string[]): void {
  assert.ok(releaseError instanceof assert.AssertionError, 'the release fails with an AssertionError');
  assert.equal(releaseError.message.split('\n')[0], finding);
  assert.deepEqual(releaseError.actual, refusedRequests);
}

async function serveEchoOnLoopback(t: TestContext): Promise<string> {
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += String(chunk);
    response.end(JSON.stringify({ method: request.method, path: request.url, body }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, resolve);
  });
  t.after(() => closeServer(server));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describe('Outbound fetch guard of the test process', () => {
  test('Given a guard that refuses each request, when a request to a public URL runs, then the request fails with the refusal, the record of the guard lists the URL at once, and the release puts the real fetch back and fails with the finding, which lists the URL', async () => {
    const realFetch = globalThis.fetch;
    const guard = outboundFetchGuard({ refusal, finding });

    const releaseError = await whileInstalled(guard, async () => {
      await assert.rejects(fetch('https://example.com/'), refused);
      assert.deepEqual(guard.refusedRequests, ['https://example.com/']);
    });

    assert.equal(globalThis.fetch, realFetch);
    assertFinding(releaseError, ['https://example.com/']);
  });

  test('Given a guard that refuses each request, when a Request object and a URL object are refused, then the finding lists the URL of each', async () => {
    const realFetch = globalThis.fetch;
    const guard = outboundFetchGuard({ refusal, finding });

    const releaseError = await whileInstalled(guard, async () => {
      await assert.rejects(fetch(new Request('https://example.com/form', { method: 'POST', body: 'a=1' })), refused);
      await assert.rejects(fetch(new URL('https://example.com/search?q=1')), refused);
    });

    assert.equal(globalThis.fetch, realFetch);
    assertFinding(releaseError, ['https://example.com/form', 'https://example.com/search?q=1']);
  });

  test('Given a guard that lets requests to 127.0.0.1 through and a local server on that address, when a POST with a body and a Request object go to the server, then the real fetch sends each with its method and its body, the answers of the server come back, and the release passes and puts the real fetch back', async (t) => {
    const realFetch = globalThis.fetch;
    const origin = await serveEchoOnLoopback(t);
    const guard = outboundFetchGuard({ allowLoopback: true, refusal, finding });
    const answers: unknown[] = [];

    const releaseError = await whileInstalled(guard, async () => {
      answers.push(await (await fetch(`${origin}/form`, { method: 'POST', body: 'a=1' })).json());
      answers.push(await (await fetch(new Request(`${origin}/page?q=1`))).json());
    });

    assert.deepEqual(answers, [
      { method: 'POST', path: '/form', body: 'a=1' },
      { method: 'GET', path: '/page?q=1', body: '' },
    ]);
    assert.equal(releaseError, undefined);
    assert.equal(globalThis.fetch, realFetch);
  });

  test('Given a guard that lets requests to 127.0.0.1 through, when a request to a public URL and a request to localhost run, then each request fails with the refusal, and the finding lists both', async () => {
    const realFetch = globalThis.fetch;
    const guard = outboundFetchGuard({ allowLoopback: true, refusal, finding });

    const releaseError = await whileInstalled(guard, async () => {
      await assert.rejects(fetch('https://example.com/'), refused);
      await assert.rejects(fetch('http://localhost:8080/'), refused);
    });

    assert.equal(globalThis.fetch, realFetch);
    assertFinding(releaseError, ['https://example.com/', 'http://localhost:8080/']);
  });
});

describe('Outbound fetch guard of a describe block', () => {
  const realFetch = globalThis.fetch;
  const refusedRequests = guardOutboundFetch({ refusal, finding });
  after(() => assert.equal(globalThis.fetch, realFetch, 'after the block, the real fetch is back'));

  test('Given guardOutboundFetch in a describe block, when a test of the block runs, then the guard has replaced the real fetch and the record that guardOutboundFetch gives is empty, and at the end of the block an after hook finds the real fetch back', () => {
    assert.notEqual(globalThis.fetch, realFetch);
    assert.deepEqual(refusedRequests, []);
  });
});
