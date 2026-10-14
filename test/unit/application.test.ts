import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routeHostedRequests, routeLocalRequests } from '../../src/application.ts';

const routeConfig = {
  publicBaseUrl: 'https://thermus.example/team/',
  mcpResourceUrl: 'https://thermus.example/team/mcp',
  resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/team/mcp',
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
    const request = new Request(`https://thermus.example${path}?state=opaque-value`, { method: 'POST', body: 'request body' });

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
  '/team/organizations',
  '/team/organizations/select',
  '/team/onboarding',
];

test('Given a local installation, when private, hosted organization, or unknown paths are requested, then each returns 404 without calling a route owner', async () => {
  const { route, calls } = recordingRoutes();

  for (const path of privateRoutes) {
    const response = await route(new Request(`https://thermus.example${path}`, { method: 'POST' }));
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
    const request = new Request(`https://thermus.example${path}?organizationId=org-a`, { method: 'POST', body: 'organizationId=org-b' });

    const response = await route(request);

    assert.equal(await response.text(), owner);
    assert.deepEqual(calls, [{ route: owner, request }]);
    assert.equal(await calls[0].request.text(), 'organizationId=org-b');
  });
}

test('Given a hosted installation under a URL path, when paths outside that path are requested, then each returns 404 without calling a handler', async () => {
  const { route, calls } = recordingHostedRoutes();

  for (const path of ['/', '/team', '/mcp', '/account', '/billing/seats', '/.well-known/oauth-authorization-server/team/api/auth', '/teams/account']) {
    const response = await route(new Request(`https://thermus.example${path}`, { method: 'POST' }));
    assert.equal(response.status, 404, path);
  }

  assert.deepEqual(calls, []);
});

test('Given hosted browser routes of the provider, when their paths are requested, then they answer before the account routes, and every other path keeps its owner', async () => {
  const calls: string[] = [];
  const handler = (route: string) => async () => {
    calls.push(route);
    return new Response(route);
  };
  const browserPaths = new Set(['/team/login', '/team/callback', '/team/logout', '/team/session']);
  const route = routeHostedRequests(routeConfig, {
    mcp: handler('mcp'),
    account: handler('account'),
    browser: { handles: (pathname) => browserPaths.has(pathname), handle: handler('browser') },
  });

  const owners = [];
  for (const path of ['/team/login', '/team/callback', '/team/logout', '/team/session', '/team/organizations', '/team/mcp', '/team/loginx', '/login']) {
    owners.push([path, await (await route(new Request(`https://thermus.example${path}`))).text()]);
  }

  assert.deepEqual(owners, [
    ['/team/login', 'browser'], ['/team/callback', 'browser'], ['/team/logout', 'browser'], ['/team/session', 'browser'],
    ['/team/organizations', 'account'], ['/team/mcp', 'mcp'], ['/team/loginx', 'account'], ['/login', 'Not Found'],
  ]);
});
