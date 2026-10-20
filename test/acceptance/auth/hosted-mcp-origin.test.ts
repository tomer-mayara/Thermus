import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { openHostedFetchSite } from '../../support/in-process/hosted-fetch-site.ts';

test('Given a hosted MCP resource, when a request carries a foreign, malformed, or opaque Origin, then it gets 403 before WorkOS receives a request, with or without a bearer token', async (t) => {
  const { application, config, world, token } = await openHostedFetchSite(t);
  world.fake.takeRequests();

  for (const origin of ['https://evil.example', 'not an origin', 'null', 'https://thermus.example/path']) {
    for (const credential of [undefined, token]) {
      const response = await application.handle(mcpRequest({
        url: config.mcpResourceUrl, method: 'tools/list', token: credential, headers: { Origin: origin },
      }));

      assert.equal(response.status, 403, `${origin}, bearer token: ${credential !== undefined}`);
      assert.equal(response.headers.get('WWW-Authenticate'), null);
    }
  }

  assert.deepEqual(world.fake.takeRequests(), []);
});

test('Given a hosted MCP resource, when a native client omits Origin or a browser sends the public origin, then a valid bearer token lists the fetch tool and no token receives the metadata challenge', async (t) => {
  const { application, config, token } = await openHostedFetchSite(t);
  const origins: readonly Record<string, string>[] = [{}, { Origin: new URL(config.publicBaseUrl).origin }];

  for (const headers of origins) {
    const authorized = await application.handle(mcpRequest({ url: config.mcpResourceUrl, method: 'tools/list', token, headers }));
    const anonymous = await application.handle(mcpRequest({ url: config.mcpResourceUrl, method: 'tools/list', headers }));

    assert.equal(authorized.status, 200);
    const { tools } = await rpcResult(authorized) as { tools: ReadonlyArray<{ name: string }> };
    assert.deepEqual(tools.map(({ name }) => name), ['getURLAsMarkdown', 'search']);
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get('WWW-Authenticate') ?? '', /resource_metadata=/);
  }
});

test('Given hosted protected-resource metadata, when a client reads it with a foreign Origin, then it stays public and names the MCP resource', async (t) => {
  const { application, config } = await openHostedFetchSite(t);

  const response = await application.handle(new Request(config.resourceMetadataUrl, { headers: { Origin: 'https://evil.example' } }));

  assert.equal(response.status, 200);
  assert.equal((await response.json() as { resource: string }).resource, config.mcpResourceUrl);
});
