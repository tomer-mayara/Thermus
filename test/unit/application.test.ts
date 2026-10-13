import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountFailureReporter, operatorFailureReporter, routeHostedRequests, routeLocalRequests } from '../../src/application.ts';
import type { FailureReport } from '../../src/mcp/mcp-server.ts';

class RecordingLogger {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(message); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

const reports: ReadonlyArray<{ label: string; report: FailureReport; line: string }> = [
  {
    label: 'a token-verification report with an error cause',
    report: { step: 'token-verification', cause: new Error('identity provider unavailable') },
    line: 'An MCP request failed unexpectedly in token-verification: Error: identity provider unavailable',
  },
  {
    label: 'an access-resolution report with an error cause',
    report: { step: 'access-resolution', cause: new RangeError('membership lookup timed out') },
    line: 'An MCP request failed unexpectedly in access-resolution: RangeError: membership lookup timed out',
  },
  {
    label: 'a report with a cause that is not an error',
    report: { step: 'access-resolution', cause: 'membership store closed' },
    line: 'An MCP request failed unexpectedly in access-resolution: membership store closed',
  },
];

for (const { label, report, line } of reports) {
  test(`Given ${label}, when the application gives it to the operator, then the log gets one error line with the failed step and the cause`, () => {
    const logger = new RecordingLogger();

    operatorFailureReporter(logger)(report);

    assert.deepEqual(logger.lines, [`ERROR ${line}`]);
  });
}

test('Given an account failure report, when the application gives it to the operator, then the log gets one error line with the path and the cause, also for a cause that is not an error', () => {
  const logger = new RecordingLogger();

  accountFailureReporter(logger)({ path: '/team/organizations', cause: new Error('organization directory timed out') });
  accountFailureReporter(logger)({ path: '/team/organizations/select', cause: 'session provider closed' });

  assert.deepEqual(logger.lines, [
    'ERROR An account request failed unexpectedly for /team/organizations: Error: organization directory timed out',
    'ERROR An account request failed unexpectedly for /team/organizations/select: session provider closed',
  ]);
});

const routeConfig = {
  publicBaseUrl: 'https://magumagu.example/team/',
  mcpResourceUrl: 'https://magumagu.example/team/mcp',
  resourceMetadataUrl: 'https://magumagu.example/.well-known/oauth-protected-resource/team/mcp',
};

function recordingRoutes() {
  const calls: { route: string; request: Request }[] = [];
  const handler = (route: string) => async (request: Request) => {
    calls.push({ route, request });
    return new Response(route);
  };
  const route = routeLocalRequests(routeConfig, {
    mcp: handler('mcp'),
    provider: handler('provider'),
    pages: {
      handles: (pathname) => ['/team/sign-in', '/team/consent', '/team/authorization-error'].includes(pathname),
      handle: handler('pages'),
    },
  });
  return { calls, route };
}

const publicRoutes = [
  { path: '/team/mcp', owner: 'mcp' },
  { path: '/.well-known/oauth-protected-resource', owner: 'provider' },
  { path: '/.well-known/oauth-protected-resource/team/mcp', owner: 'provider' },
  { path: '/.well-known/oauth-authorization-server/team/api/auth', owner: 'provider' },
  { path: '/team/api/auth/.well-known/openid-configuration', owner: 'provider' },
  { path: '/team/api/auth/oauth2/authorize', owner: 'provider' },
  { path: '/team/api/auth/oauth2/token', owner: 'provider' },
  { path: '/team/sign-in', owner: 'pages' },
  { path: '/team/consent', owner: 'pages' },
  { path: '/team/authorization-error', owner: 'pages' },
];

for (const { path, owner } of publicRoutes) {
  test(`Given a local installation under a URL path, when ${path} is requested, then its owner receives the complete request`, async () => {
    const { route, calls } = recordingRoutes();
    const request = new Request(`https://magumagu.example${path}?state=opaque-value`, { method: 'POST', body: 'request body' });

    const response = await route(request);

    assert.equal(await response.text(), owner);
    assert.deepEqual(calls, [{ route: owner, request }]);
    assert.equal(await calls[0].request.text(), 'request body');
  });
}

const privateRoutes = [
  '/team/api/auth/oauth2/introspect',
  '/team/api/auth/oauth2/client/rotate-secret',
  '/team/api/auth/oauth2/get-client',
  '/team/api/auth/oauth2/create-client',
  '/team/api/auth/admin/oauth2/create-client',
  '/team/api/auth/sign-in/email',
  '/team/api/auth/sign-up/email',
  '/team/api/auth/get-session',
  '/team/api/auth/token',
  '/team/api/auth/oauth2/register',
  '/team/api/auth/oauth2/token/extra',
  '/team/api/auth/oauth2/token/',
  '/api/auth/oauth2/token',
  '/mcp',
  '/unknown',
];

test('Given a local installation, when private or unknown paths are requested, then each returns 404 without calling a route owner', async () => {
  const { route, calls } = recordingRoutes();

  for (const path of privateRoutes) {
    const response = await route(new Request(`https://magumagu.example${path}`, { method: 'POST' }));
    assert.equal(response.status, 404, path);
  }

  assert.deepEqual(calls, []);
});

function recordingHostedRoutes() {
  const calls: { route: string; request: Request }[] = [];
  const handler = (route: string) => async (request: Request) => {
    calls.push({ route, request });
    return new Response(route);
  };
  const route = routeHostedRequests(routeConfig, { mcp: handler('mcp'), account: handler('account') });
  return { calls, route };
}

const hostedRoutes = [
  { path: '/team/mcp', owner: 'mcp' },
  { path: '/.well-known/oauth-protected-resource', owner: 'mcp' },
  { path: '/.well-known/oauth-protected-resource/team/mcp', owner: 'mcp' },
  { path: '/team/', owner: 'account' },
  { path: '/team/account', owner: 'account' },
  { path: '/team/auth/sign-in', owner: 'account' },
  { path: '/team/organizations/select', owner: 'account' },
  { path: '/team/billing/seats', owner: 'account' },
  { path: '/team/mcp/extra', owner: 'account' },
  { path: '/team/api/auth/oauth2/token', owner: 'account' },
];

for (const { path, owner } of hostedRoutes) {
  test(`Given a hosted installation under a URL path, when ${path} is requested, then the ${owner} handler receives the complete request`, async () => {
    const { route, calls } = recordingHostedRoutes();
    const request = new Request(`https://magumagu.example${path}?organizationId=org-a`, { method: 'POST', body: 'organizationId=org-b' });

    const response = await route(request);

    assert.equal(await response.text(), owner);
    assert.deepEqual(calls, [{ route: owner, request }]);
    assert.equal(await calls[0].request.text(), 'organizationId=org-b');
  });
}

test('Given a hosted installation under a URL path, when paths outside that path are requested, then each returns 404 without calling a handler', async () => {
  const { route, calls } = recordingHostedRoutes();

  for (const path of ['/', '/team', '/mcp', '/account', '/billing/seats', '/.well-known/oauth-authorization-server/team/api/auth', '/teams/account']) {
    const response = await route(new Request(`https://magumagu.example${path}`, { method: 'POST' }));
    assert.equal(response.status, 404, path);
  }

  assert.deepEqual(calls, []);
});
