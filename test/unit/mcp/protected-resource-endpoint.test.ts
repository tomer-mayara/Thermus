import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ProtectedResourceEndpoint } from '../../../src/interfaces/mcp/protected-resource-endpoint.ts';

const origin = 'https://thermus.example';
const mcpResourceUrl = `${origin}/team/mcp`;
const resourceMetadataUrl = `${origin}/.well-known/oauth-protected-resource/team/mcp`;
const authorizationServer = 'https://example-staging.authkit.app';
const metadataPaths = ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/team/mcp'];

class McpServerDouble {
  readonly requests: Request[] = [];
  closeCount = 0;

  async fetch(request: Request): Promise<Response> {
    this.requests.push(request);
    return new Response('answer of the MCP server', { status: 202 });
  }

  async close(): Promise<void> {
    this.closeCount += 1;
  }
}

function endpointWith(settings: { authorizationServer?: string } = {}) {
  const server = new McpServerDouble();
  const endpoint = new ProtectedResourceEndpoint({
    server,
    mcpResourceUrl,
    resourceMetadataUrl,
    authorizationServer: settings.authorizationServer ?? authorizationServer,
  });
  return { server, endpoint };
}

describe('ProtectedResourceEndpoint', () => {
  test('Given the hosted MCP resource, when a client reads the protected-resource metadata at the root path or the path of the resource, then each answer is the RFC 9728 document with the MCP resource and AuthKit as its one authorization server, and the MCP server gets no request', async () => {
    const { server, endpoint } = endpointWith();

    for (const path of metadataPaths) {
      const response = await endpoint.fetch(new Request(`${origin}${path}`));

      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('Content-Type') ?? '', /^application\/json/);
      assert.deepEqual(JSON.parse(await response.text()), { resource: mcpResourceUrl, authorization_servers: [authorizationServer] });
    }
    assert.deepEqual(server.requests, []);
  });

  test('Given a HEAD request for the metadata, when it arrives, then it gets 200 with the JSON content type and no body', async () => {
    const { server, endpoint } = endpointWith();

    for (const path of metadataPaths) {
      const response = await endpoint.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }));

      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('Content-Type') ?? '', /^application\/json/);
      assert.equal(await response.text(), '');
    }
    assert.deepEqual(server.requests, []);
  });

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    test(`Given a request with the method ${method} for the metadata, when it arrives, then it gets 405 with Allow: GET, HEAD, its body stays unread, and the MCP server gets no request`, async () => {
      const { server, endpoint } = endpointWith();

      for (const path of metadataPaths) {
        const request = new Request(`${origin}${path}`, { method, ...(method === 'POST' || method === 'PUT' || method === 'PATCH' ? { body: '{}' } : {}) });
        const response = await endpoint.fetch(request);

        assert.equal(response.status, 405, path);
        assert.equal(response.headers.get('Allow'), 'GET, HEAD');
        assert.equal(request.bodyUsed, false);
      }
      assert.deepEqual(server.requests, []);
    });
  }

  test('Given MCP requests and a request for another path, when they arrive, then each reaches the MCP server unchanged and gets its answer', async () => {
    const { server, endpoint } = endpointWith();
    const requests = [
      new Request(mcpResourceUrl, { method: 'POST', headers: { Authorization: 'Bearer connect-token', 'Content-Type': 'application/json' }, body: '{}' }),
      new Request(mcpResourceUrl, { headers: { Accept: 'text/event-stream' } }),
      new Request(`${origin}/.well-known/oauth-protected-resource/other`),
    ];

    for (const request of requests) {
      const response = await endpoint.fetch(request);
      assert.equal(response.status, 202);
      assert.equal(await response.text(), 'answer of the MCP server');
    }

    assert.equal(server.requests.length, requests.length);
    assert.ok(server.requests.every((request, index) => request === requests[index]));
  });

  test('Given the endpoint, when it closes, then it closes the MCP server', async () => {
    const { server, endpoint } = endpointWith();

    await endpoint.close();

    assert.equal(server.closeCount, 1);
  });

  test('Given an authorization server without https, when the endpoint is made, then it fails before any request', () => {
    assert.throws(() => endpointWith({ authorizationServer: 'http://example-staging.authkit.app' }), /HTTPS/);
  });
});
