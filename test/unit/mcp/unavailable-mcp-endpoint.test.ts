import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { UnavailableMcpEndpoint } from '../../../src/mcp/unavailable-mcp-endpoint.ts';
import { mcpUnavailableAnswer } from '../../support/hosted-placeholder.ts';

const resourceUrl = 'https://thermus.example/mcp';

function mcpRequests(): Request[] {
  const call = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetch', arguments: { organizationId: 'org_01FORGED' } } });
  const json = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  return [
    new Request(resourceUrl, { method: 'POST', headers: { ...json, Authorization: 'Bearer forged-connect-token' }, body: call }),
    new Request(resourceUrl, { method: 'POST', headers: { ...json, Cookie: 'wos-session=forged-sealed-session' }, body: call }),
    new Request(resourceUrl, { headers: { Accept: 'text/event-stream', Authorization: 'Bearer forged-connect-token' } }),
    new Request(resourceUrl, { method: 'DELETE', headers: { 'Mcp-Session-Id': 'forged-session-id' } }),
    new Request('https://thermus.example/.well-known/oauth-protected-resource/mcp'),
  ];
}

describe('UnavailableMcpEndpoint', () => {
  test('Given any MCP or metadata request, also with a forged bearer token, cookie, or organization value, when it arrives, then it gets 503 temporarily_unavailable that no one may store, with no Bearer challenge and no cookie, and its body stays unread', async () => {
    const endpoint = new UnavailableMcpEndpoint();
    const requests = mcpRequests();

    for (const request of requests) {
      const response = await endpoint.fetch(request);
      assert.equal(response.status, 503);
      assert.deepEqual([response.headers.get('Cache-Control'), response.headers.get('WWW-Authenticate'), response.headers.get('Set-Cookie')], ['no-store', null, null]);
      assert.match(response.headers.get('Content-Type') ?? '', /^application\/json/);
      assert.deepEqual(await response.json(), mcpUnavailableAnswer);
    }

    assert.deepEqual(requests.map(({ bodyUsed }) => bodyUsed), requests.map(() => false));
  });

  test('Given the endpoint, when it closes two times, then each close succeeds', async () => {
    const endpoint = new UnavailableMcpEndpoint();

    await endpoint.close();
    await endpoint.close();
  });
});
