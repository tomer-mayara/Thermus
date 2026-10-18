import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SdkHttpError, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { connectMcpClient } from '../../support/drivers/mcp/mcp-sdk-client.ts';
import { generatedOperationIdPattern } from '../../support/fixtures/execution-context.ts';

for (const era of mcpProtocolEras) {
  test(`Given missing or malformed Bearer credentials in ${era}, when the fetch HTTP resource is requested, then authentication refuses before fetch or completion`, async (t) => {
    const site = await openFetchSite(t, era);
    for (const authorization of [undefined, 'Basic private-credential', 'Bearer', 'Bearer ', 'Bearer two tokens', 'Bearer token,second', 'Bearer  doubled-space']) {
      const response = await fetch(site.url, { method: 'POST', headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        ...(authorization === undefined ? {} : { Authorization: authorization }),
        'MCP-Protocol-Version': era,
      }, body: '{}' });
      assert.equal(response.status, 401);
      assert.ok(response.headers.get('WWW-Authenticate'));
      assert.doesNotMatch(await response.text(), /private-credential|two tokens|token,second|doubled-space/);
    }
    assert.deepEqual(site.fetchCalls, []);
    assert.deepEqual(site.records, []);
  });

  test(`Given denied resource access in ${era}, when the HTTP client connects, then it gets 403 before operation work`, async (t) => {
    let fetches = 0;
    await assert.rejects(openFetchSite(t, era, {
      resolver: { resolve: async () => ({ allowed: false, reason: 'account-inactive' }) },
      fetcher: { fetchURL: async () => { fetches += 1; throw new Error('must not fetch'); } },
    }), (error) => error instanceof SdkHttpError && error.status === 403);
    assert.equal(fetches, 0);
  });

  test(`Given a trusted context without product access in ${era}, when the HTTP tool is called, then the operation refuses before fetch`, async (t) => {
    const site = await openFetchSite(t, era, { resolver: { resolve: async (user) => ({ allowed: true, context: {
      user, tenantId: 'synthetic-workspace', grants: [], permissions: [],
    } }) } });
    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });
    assert.deepEqual(result.content, [{ type: 'text', text: 'Access denied' }]);
    assert.equal(result.isError, true);
    assert.deepEqual(site.fetchCalls, []);
    assert.deepEqual(site.pipelineCalls, []);
    assert.equal(site.completionLines().length, 1);
    assert.equal(JSON.parse(site.completionLines()[0]).status, 'access_denied');
    assert.match(JSON.parse(site.completionLines()[0]).operationId, generatedOperationIdPattern);
  });

  test(`Given a second supplied token in ${era}, when another HTTP client calls the tool, then test auth keeps the same synthetic authority and subject`, async (t) => {
    const site = await openFetchSite(t, era);
    const client = await connectMcpClient(t, new StreamableHTTPClientTransport(site.url, { authProvider: { token: async () => 'different-supplied-token' } }), { era, checkEra: false });
    t.after(() => client.close());
    await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });
    await client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });
    assert.equal(site.completionLines().length, 2);
    for (const encoded of site.completionLines()) {
      const record = JSON.parse(encoded);
      assert.match(record.operationId, generatedOperationIdPattern);
      assert.equal(record.subject, 'synthetic-user');
      assert.equal(record.authority, 'https://synthetic-auth.thermus.invalid');
      assert.equal(record.tenantId, 'synthetic-workspace');
      assert.doesNotMatch(encoded, /different-supplied-token|arbitrary-test-token/);
    }
  });

  test(`Given malformed JSON or a body larger than 4 MiB in ${era}, when HTTP input reaches the SDK, then it refuses before dispatch and no completion is emitted`, async (t) => {
    const site = await openFetchSite(t, era);
    const malformed = await fetch(site.url, { method: 'POST', headers: { Authorization: 'Bearer arbitrary-test-token', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': era }, body: '{bad-json' });
    assert.equal(malformed.status, 400);
    assert.doesNotMatch(await malformed.text(), /bad-json/);
    await assert.rejects(site.client.callTool({ name: 'getURLAsMarkdown', arguments: { ...validFetchArguments, reason: 'x'.repeat(4 * 1024 * 1024) } }), (error) => error instanceof SdkHttpError && error.status === 413);
    assert.deepEqual(site.fetchCalls, []);
    assert.deepEqual(site.records, []);
  });
}
