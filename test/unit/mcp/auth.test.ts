import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
  SERVER_INFO_META_KEY,
} from '@modelcontextprotocol/server';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { InvalidAccessTokenError, type VerifiedIdentity } from '../../../src/mcp/identity-verifier.ts';
import { IdentityVerifierMock } from './fixtures/identity-verifier-mock.ts';

describe('MCPServer HTTP authentication', () => {
  const resourceUrl = 'https://magumagu.example/mcp';
  const resourceMetadataUrl = 'https://magumagu.example/.well-known/oauth-protected-resource/mcp';
  let server: MCPServer;
  let verifier: IdentityVerifierMock;

  beforeEach(() => {
    verifier = new IdentityVerifierMock(new Map<string, VerifiedIdentity | Error>([
      ['accepted-token', {
        clientId: 'test-client',
        scopes: [],
        expiresAtUnixSeconds: 2_524_608_000,
        resource: new URL(resourceUrl),
      }],
      ['rejected-token', new InvalidAccessTokenError('private rejection for rejected-token')],
      ['error-token', new Error('private verifier failure for error-token')],
    ]));
    server = new MCPServer({ auth: { verifier, resourceMetadataUrl } });
  });

  afterEach(async () => {
    await server.close();
  });

  for (const method of ['server/discover', 'tools/list', 'tools/call']) {
    test(`Given no Bearer token, when an HTTP client requests ${method}, then the server returns 401 with a Bearer challenge and its protected-resource metadata URL`, { timeout: 5_000 }, async (context) => {
      const protocolVersion = '2026-07-28';
      const toolName = 'fetchURLAsMarkdown';
      const headers = new Headers({
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': protocolVersion,
        'Mcp-Method': method,
      });
      const params = {
        _meta: {
          [PROTOCOL_VERSION_META_KEY]: protocolVersion,
          [CLIENT_INFO_META_KEY]: { name: 'magumagu-test', version: '0.0.0' },
          [CLIENT_CAPABILITIES_META_KEY]: {},
        },
        ...(method === 'tools/call' ? {
          name: toolName,
          arguments: { url: 'https://example.com/' },
        } : {}),
      };
      if (method === 'tools/call') headers.set('Mcp-Name', toolName);

      const response = await server.fetch(new Request(resourceUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: context.signal,
      }));

      assert.equal(response.status, 401);
      const challenge = response.headers.get('WWW-Authenticate');
      assert.ok(challenge);
      assert.match(challenge, /^Bearer\s+/i);
      const metadata = challenge.replace(/^Bearer\s+/i, '')
        .match(/(?:^|,)\s*resource_metadata\s*=\s*"([^"]+)"/i);
      assert.equal(metadata?.[1], resourceMetadataUrl);
    });
  }

  function discoveryRequest(token: string, signal: AbortSignal): Request {
    const protocolVersion = '2026-07-28';
    return new Request(resourceUrl, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': protocolVersion,
        'Mcp-Method': 'server/discover',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'server/discover',
        params: {
          _meta: {
            [PROTOCOL_VERSION_META_KEY]: protocolVersion,
            [CLIENT_INFO_META_KEY]: { name: 'magumagu-test', version: '0.0.0' },
            [CLIENT_CAPABILITIES_META_KEY]: {},
          },
        },
      }),
    });
  }

  test('Given an accepted token, when an HTTP client discovers the server, then discovery succeeds and verification receives the raw token', { timeout: 5_000 }, async (context) => {
    const response = await server.fetch(discoveryRequest('accepted-token', context.signal));
    assert.equal(response.status, 200);
    const body = await response.text();
    const data = response.headers.get('Content-Type')?.startsWith('text/event-stream')
      ? body.split('\n').find((line) => line.startsWith('data: '))?.slice(6)
      : body;
    assert.ok(data);
    const discovery = JSON.parse(data).result;
    assert.equal(discovery._meta[SERVER_INFO_META_KEY].name, 'magumagu');
    assert.ok(discovery.supportedVersions.includes('2026-07-28'));
    assert.deepEqual(verifier.calls, ['accepted-token']);
  });

  test('Given a rejected token, when an HTTP client discovers the server, then it receives invalid_token and a metadata challenge', { timeout: 5_000 }, async (context) => {
    const response = await server.fetch(discoveryRequest('rejected-token', context.signal));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'invalid_token', error_description: 'Invalid access token' });
    const challenge = response.headers.get('WWW-Authenticate');
    assert.ok(challenge);
    assert.match(challenge, /^Bearer\s+/i);
    assert.ok(challenge.includes(`resource_metadata="${resourceMetadataUrl}"`));
  });

  test('Given an unexpected verifier failure, when an HTTP client discovers the server, then it receives a generic error without private details', { timeout: 5_000 }, async (context) => {
    const response = await server.fetch(discoveryRequest('error-token', context.signal));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'server_error', error_description: 'Internal Server Error' });
    assert.equal(response.headers.get('WWW-Authenticate'), null);
  });
});
