import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PerRequestHTTPServerTransport,
  PROTOCOL_VERSION_META_KEY,
  SERVER_INFO_META_KEY,
} from '@modelcontextprotocol/server';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { InvalidAccessTokenError, type VerifiedIdentity } from '../../../src/mcp/identity-verifier.ts';
import type { AuthenticatedUser } from '../../../src/auth/access-context.ts';
import { AccessResolverMock } from './fixtures/access-resolver-mock.ts';
import { FailureReporterMock } from './fixtures/failure-reporter-mock.ts';
import { IdentityVerifierMock } from './fixtures/identity-verifier-mock.ts';

describe('MCPServer HTTP authentication', () => {
  const resourceUrl = 'https://magumagu.example/mcp';
  const resourceMetadataUrl = 'https://magumagu.example/.well-known/oauth-protected-resource/mcp';
  const user: AuthenticatedUser = { authority: 'https://auth.magumagu.example', subject: 'test-user' };
  let server: MCPServer;
  let verifier: IdentityVerifierMock;
  let resolver: AccessResolverMock;
  let reporter: FailureReporterMock;

  beforeEach(() => {
    verifier = new IdentityVerifierMock(new Map<string, VerifiedIdentity | Error>([
      ['accepted-token', {
        user,
        issuer: 'https://auth.magumagu.example',
        clientId: 'test-client',
        scopes: [],
        issuedAtUnixSeconds: 2_524_604_400,
        expiresAtUnixSeconds: 2_524_608_000,
        resource: new URL(resourceUrl),
      }],
      ['rejected-token', new InvalidAccessTokenError('private rejection for rejected-token')],
      ['error-token', new Error('private verifier failure for error-token')],
    ]));
    resolver = new AccessResolverMock(new Map([[user.subject, {
      allowed: true,
      context: { user, tenantId: 'local:test-installation', grants: [], permissions: [] },
    }]]));
    reporter = new FailureReporterMock();
    server = new MCPServer({
      auth: { verifier, accessResolver: resolver, resourceMetadataUrl, expectedResource: new URL(resourceUrl) },
      reportFailure: reporter.report,
    });
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

  test('Given no Authorization header, when an HTTP client discovers the server, then it receives 401 before verification or MCP dispatch', { timeout: 5_000 }, async (context) => {
    const dispatchSpy = context.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
    const request = discoveryRequest('accepted-token', context.signal);
    request.headers.delete('Authorization');

    const response = await server.fetch(request);

    assert.equal(response.status, 401);
    assert.deepEqual(verifier.calls, []);
    assert.equal(dispatchSpy.mock.callCount(), 0);
  });

  for (const { label, authorization } of [
    { label: 'the wrong scheme', authorization: 'Basic accepted-token' },
    { label: 'missing credentials', authorization: 'Bearer' },
    { label: 'no scheme and token separator', authorization: 'Beareraccepted-token' },
    { label: 'extra token text', authorization: 'Bearer accepted-token extra' },
    { label: 'combined credentials', authorization: 'Bearer accepted-token, Bearer rejected-token' },
  ]) {
    test(`Given an Authorization header with ${label}, when an HTTP client discovers the server, then it receives 401 before verification or MCP dispatch`, { timeout: 5_000 }, async (context) => {
      const dispatchSpy = context.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
      const request = discoveryRequest('accepted-token', context.signal);
      request.headers.set('Authorization', authorization);

      const response = await server.fetch(request);

      assert.deepEqual({
        status: response.status,
        verifierCalls: verifier.calls,
        dispatchCalls: dispatchSpy.mock.callCount(),
      }, {
        status: 401,
        verifierCalls: [],
        dispatchCalls: 0,
      });
    });
  }

  test('Given an accepted token, when an HTTP client discovers the server, then discovery succeeds and verification receives the raw token', { timeout: 5_000 }, async (context) => {
    const dispatchSpy = context.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
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
    assert.deepEqual(resolver.calls, [user]);
    assert.equal(dispatchSpy.mock.callCount(), 1);
    assert.equal(dispatchSpy.mock.calls[0].arguments[0].method, 'server/discover');
  });

  test('Given a rejected token, when an HTTP client discovers the server, then it receives invalid_token and a metadata challenge', { timeout: 5_000 }, async (context) => {
    const response = await server.fetch(discoveryRequest('rejected-token', context.signal));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'invalid_token', error_description: 'Invalid access token' });
    const challenge = response.headers.get('WWW-Authenticate');
    assert.ok(challenge);
    assert.match(challenge, /^Bearer\s+/i);
    assert.ok(challenge.includes(`resource_metadata="${resourceMetadataUrl}"`));
    assert.deepEqual(resolver.calls, []);
  });

  test('Given an unexpected verifier failure, when an HTTP client discovers the server, then it receives a generic error without private details', { timeout: 5_000 }, async (context) => {
    const dispatchSpy = context.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
    const response = await server.fetch(discoveryRequest('error-token', context.signal));
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), { error: 'server_error', error_description: 'Internal Server Error' });
    assert.doesNotMatch(body, /private|error-token/);
    assert.equal(response.headers.get('WWW-Authenticate'), null);
    assert.deepEqual(resolver.calls, []);
    assert.equal(dispatchSpy.mock.callCount(), 0);
  });
});
