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

test('Given a hosted MCP resource, when any HTTP method carries a refused Origin, then no route owner receives the request', async () => {
  const { route, calls } = recordingHostedRoutes();
  const origins = [
    '', 'null', 'not an origin', 'https://evil.example', 'http://thermus.example', 'https://thermus.example:8443',
    'https://thermus.example/', 'https://thermus.example/team/', 'https://thermus.example?x=1', 'https://thermus.example#fragment',
    'https://user:password@thermus.example', 'https://thermus.example, https://evil.example',
    'https://thermus.example https://evil.example', 'https://thermus.example, https://thermus.example',
    'https://thermus.example junk', 'https://thermus.example\\', 'https://THERMUS.example', 'https://thermus.example:443',
  ];

  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    for (const origin of origins) {
      const response = await route(new Request(routeConfig.mcpResourceUrl, { method, headers: { Origin: origin } }));

      assert.equal(response.status, 403, `${method} ${JSON.stringify(origin)}`);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
  }

  assert.deepEqual(calls, []);
});

test('Given a hosted MCP resource, when Origin is absent or equals the serialized public origin, then each method reaches MCP with the complete request', async () => {
  const { route, calls } = recordingHostedRoutes();

  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    for (const headers of [{}, { Origin: 'https://thermus.example' }]) {
      const request = new Request(`${routeConfig.mcpResourceUrl}?resource=value`, { method, headers });
      const response = await route(request);

      assert.equal(response.status, 200);
      assert.equal(calls.at(-1)?.request, request);
    }
  }

  assert.equal(calls.length, 14);
  assert.ok(calls.every(({ route }) => route === 'mcp'));
});

test('Given a hosted MCP resource, when repeated Origin headers name the public origin, then the combined header is refused before MCP', async () => {
  const { route, calls } = recordingHostedRoutes();
  const request = new Request(routeConfig.mcpResourceUrl, {
    headers: [['Origin', 'https://thermus.example'], ['Origin', 'https://thermus.example']],
  });

  assert.equal((await route(request)).status, 403);
  assert.deepEqual(calls, []);
});

test('Given a public URL with a port and a base path, when the request URL or forwarded headers name another origin, then only the configured public origin is accepted', async () => {
  const config = {
    publicBaseUrl: 'https://thermus.example:8443/team/',
    mcpResourceUrl: 'https://thermus.example:8443/team/mcp',
    resourceMetadataUrl: 'https://thermus.example:8443/.well-known/oauth-protected-resource/team/mcp',
  };
  const route = routeHostedRequests(config, { mcp: async () => new Response('MCP'), account: async () => new Response('account') });

  for (const [origin, status] of [['https://thermus.example:8443', 200], ['https://thermus.example', 403], ['http://internal.example', 403]] as const) {
    const request = new Request('http://internal.example/team/mcp', {
      headers: { Origin: origin, Host: 'internal.example', 'X-Forwarded-Host': 'internal.example', 'X-Forwarded-Proto': 'http' },
    });

    assert.equal((await route(request)).status, status, origin);
  }
});

test('Given a hosted installation, when a foreign Origin requests metadata, account paths, or an MCP child path, then their existing owners receive the complete request', async () => {
  const { route, calls } = recordingHostedRoutes();

  for (const { path, owner } of hostedRoutes.filter(({ path }) => path !== '/team/mcp')) {
    const request = new Request(`https://thermus.example${path}`, { headers: { Origin: 'https://evil.example' } });

    assert.equal(await (await route(request)).text(), owner);
    assert.deepEqual(calls.at(-1), { route: owner, request });
  }
});

test('Given a local installation, when MCP carries a foreign Origin, then local routing still delegates the complete request to MCP', async () => {
  const { route, calls } = recordingRoutes();
  const request = new Request(routeConfig.mcpResourceUrl, { headers: { Origin: 'https://evil.example' } });

  assert.equal(await (await route(request)).text(), 'mcp');
  assert.deepEqual(calls, [{ route: 'mcp', request }]);
});
