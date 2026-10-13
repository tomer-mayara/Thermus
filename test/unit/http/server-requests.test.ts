import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CLIENT_ADDRESS_HEADER } from '../../../src/http/server.ts';
import { RawConnection, recordUrls, serve } from './fixtures/http-server-fixtures.ts';

describe('HTTP server request URL', () => {
  test('Given forged Host and forwarded headers, when a request arrives, then the handler URL has the public origin and the path and query of the target', { timeout: 5_000 }, async (t) => {
    const urls: string[] = [];
    const server = await serve(t, recordUrls(urls), { publicBaseUrl: 'https://magumagu.example/app/' });

    const response = await RawConnection.open(t, server).send([
      'GET /app/mcp?session=one&next=%2Fhome HTTP/1.1',
      'Host: evil.example:9999',
      'X-Forwarded-Host: evil.example',
      'X-Forwarded-Proto: http',
      'Forwarded: for=192.0.2.1;host=evil.example;proto=http',
      'Connection: close',
    ]).ended;

    assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
    assert.deepEqual(urls, ['https://magumagu.example/app/mcp?session=one&next=%2Fhome']);
  });

  for (const target of ['http://evil.example/x', '//evil.example/x', '/\\evil.example/x', '*', '/x#evil.example']) {
    test(`Given the request target ${target}, when it arrives, then the client gets 400 and the handler is not called`, { timeout: 5_000 }, async (t) => {
      const urls: string[] = [];
      const server = await serve(t, recordUrls(urls));

      const response = await RawConnection.open(t, server).send([`GET ${target} HTTP/1.1`, 'Host: localhost:8080', 'Connection: close']).ended;

      assert.match(response, /^HTTP\/1\.1 400 Bad Request\r\n/);
      assert.deepEqual(urls, []);
    });
  }
});

describe('HTTP server request method', () => {
  test('Given a TRACE request, which Fetch cannot represent, when it arrives, then the client gets 501, the handler is not called, and nothing is logged', { timeout: 5_000 }, async (t) => {
    const urls: string[] = [];
    const messages: string[] = [];
    const server = await serve(t, recordUrls(urls), { logger: { error: (message) => messages.push(message) } });

    const response = await RawConnection.open(t, server).send(['TRACE /x HTTP/1.1', 'Host: localhost:8080', 'Connection: close']).ended;

    assert.match(response, /^HTTP\/1\.1 501 Not Implemented\r\n/);
    assert.deepEqual(urls, []);
    assert.deepEqual(messages, []);
  });
});

describe('HTTP server request headers', () => {
  test('Given forged client address headers in any letter case, when a request arrives, then the handler gets every other header and only the socket address', { timeout: 5_000 }, async (t) => {
    const received: Array<[string, string]> = [];
    const server = await serve(t, async (request) => {
      received.push(...request.headers);
      return new Response('ok');
    });

    await RawConnection.open(t, server).send([
      'GET /headers HTTP/1.1',
      'Host: localhost:8080',
      'X-Magumagu-Client-Address: 203.0.113.9',
      'Accept: text/plain',
      'X-Custom: one',
      'x-MAGUMAGU-client-ADDRESS: 198.51.100.7',
      'x-custom: two',
      'Connection: close',
    ]).ended;

    assert.deepEqual(received, [
      ['accept', 'text/plain'],
      ['connection', 'close'],
      ['host', 'localhost:8080'],
      ['x-custom', 'one, two'],
      [CLIENT_ADDRESS_HEADER, '127.0.0.1'],
    ]);
  });
});

describe('HTTP server request body', () => {
  test('Given a JSON POST body larger than one socket read, when the handler reads it, then the same JSON reaches the client in the response', { timeout: 5_000 }, async (t) => {
    const server = await serve(t, async (request) => Response.json({ method: request.method, body: await request.json() }));
    const sent = { name: 'Ada', tags: ['x', 'y'], nested: { count: 2 }, notes: 'n'.repeat(500_000) };

    const response = await fetch(new URL('/echo', server.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sent),
    });

    assert.deepEqual(await response.json(), { method: 'POST', body: sent });
  });

  test('Given a large POST body that the handler does not read, when the client sends a second request on the same connection, then the second request also gets a response', { timeout: 5_000 }, async (t) => {
    const server = await serve(t, async (request) => new Response(null, { status: request.method === 'POST' ? 401 : 204 }));
    const body = 'x'.repeat(1_000_000);
    const connection = RawConnection.open(t, server).send(['POST /mcp HTTP/1.1', 'Host: localhost:8080', `Content-Length: ${body.length}`], body);
    await connection.received('HTTP/1.1 401 Unauthorized');

    connection.send(['GET /next HTTP/1.1', 'Host: localhost:8080', 'Connection: close']);

    assert.match(await connection.ended, /HTTP\/1\.1 204 No Content/);
  });
});
