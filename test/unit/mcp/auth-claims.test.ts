import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PerRequestHTTPServerTransport,
  PROTOCOL_VERSION_META_KEY,
} from '@modelcontextprotocol/server';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import type { VerifiedIdentity } from '../../../src/mcp/identity-verifier.ts';
import { IdentityVerifierMock } from './fixtures/identity-verifier-mock.ts';

describe('MCPServer verified claim validation', () => {
  const resourceUrl = 'https://magumagu.example/mcp';
  const resourceMetadataUrl = 'https://magumagu.example/.well-known/oauth-protected-resource/mcp';
  const nowUnixSeconds = 2_000_000_000;
  const validIdentity: VerifiedIdentity = {
    clientId: 'test-client',
    scopes: ['mcp:read'],
    expiresAtUnixSeconds: nowUnixSeconds + 60,
    resource: new URL(resourceUrl),
  };
  const { expiresAtUnixSeconds: _expiration, ...identityWithoutExpiration } = validIdentity;

  const scenarios = [
    {
      label: 'an expired token',
      token: 'expired-token',
      identity: { ...validIdentity, expiresAtUnixSeconds: nowUnixSeconds - 1 },
      status: 401,
      error: 'invalid_token',
    },
    {
      label: 'a token with no expiration',
      token: 'no-expiration-token',
      identity: identityWithoutExpiration,
      status: 401,
      error: 'invalid_token',
    },
    {
      label: 'a token issued for another audience',
      token: 'wrong-audience-token',
      identity: { ...validIdentity, resource: new URL('https://other.example/mcp') },
      status: 401,
      error: 'invalid_token',
    },
    {
      label: 'a token without the required permission',
      token: 'missing-scope-token',
      identity: { ...validIdentity, scopes: ['mcp:write'] },
      status: 403,
      error: 'insufficient_scope',
    },
  ];
  let verifier: IdentityVerifierMock;
  let server: MCPServer;

  beforeEach(() => {
    verifier = new IdentityVerifierMock(new Map(scenarios.map(({ token, identity }) => [token, identity])));
    const options = {
      auth: {
        verifier,
        resourceMetadataUrl,
        expectedResource: new URL(resourceUrl),
        requiredScopes: ['mcp:read'],
      },
    };
    server = new MCPServer(options);
  });

  afterEach(async () => {
    await server.close();
  });

  for (const scenario of scenarios) {
    test(`Given ${scenario.label}, when an HTTP client discovers the server, then it receives ${scenario.status} ${scenario.error} without MCP dispatch`, { timeout: 5_000 }, async (context) => {
      context.mock.method(Date, 'now', () => nowUnixSeconds * 1_000);
      const dispatchSpy = context.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
      const protocolVersion = '2026-07-28';
      const request = new Request(resourceUrl, {
        method: 'POST',
        signal: context.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': protocolVersion,
          'Mcp-Method': 'server/discover',
          Authorization: `Bearer ${scenario.token}`,
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

      const response = await server.fetch(request);
      const body = response.status >= 400 ? await response.json() : undefined;
      const error = typeof body === 'object' && body !== null && 'error' in body
        ? body.error : undefined;

      assert.deepEqual({
        status: response.status,
        error,
        verifierCalls: verifier.calls,
        dispatchCalls: dispatchSpy.mock.callCount(),
      }, {
        status: scenario.status,
        error: scenario.error,
        verifierCalls: [scenario.token],
        dispatchCalls: 0,
      });
      if (scenario.error === 'insufficient_scope') {
        const challenge = response.headers.get('WWW-Authenticate');
        assert.ok(challenge);
        assert.match(challenge, /^Bearer\s+/i);
        const scope = challenge.replace(/^Bearer\s+/i, '')
          .match(/(?:^|,)\s*scope\s*=\s*"([^"]+)"/i);
        assert.equal(scope?.[1], 'mcp:read');
      }
    });
  }
});
