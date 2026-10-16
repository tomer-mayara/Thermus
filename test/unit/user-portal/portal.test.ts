import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { initializePortal, type PortalOptions } from '../../../src/user-portal/portal.ts';

type Answers = Readonly<Record<string, () => Promise<Response>>>;

const session = { signedIn: true, email: 'ada@example.com', name: 'Ada Lovelace', mfaCompleted: true, csrfToken: 'csrf-secret' };

function portal(answers: Answers) {
  const { document } = parseHTML('<html><body><div id="app">Loading...</div></body></html>');
  const requests: Array<{ path: string; init: RequestInit }> = [];
  const navigations: string[] = [];
  const options: PortalOptions = {
    container: document.getElementById('app'),
    fetch: async (path, init) => {
      requests.push({ path, init });
      const answer = answers[path];
      if (answer === undefined) return assert.fail(`The portal must not request ${path}`);
      return answer();
    },
    navigate: (path) => navigations.push(path),
  };
  return { document, options, requests, navigations };
}

const signedIn = async () => Response.json(session);

test('A missing portal root makes no request', async () => {
  const { options, requests } = portal({});
  await initializePortal({ ...options, container: null });
  assert.deepEqual(requests, []);
});

test('Given a session request that fails, when the portal opens, then it shows a safe error without the failure text', async () => {
  const { document, options } = portal({ session: async () => { throw new Error('sensitive server detail'); } });
  await initializePortal(options);
  assert.match(document.body.textContent ?? '', /Authentication Error.*Failed to load your session/s);
  assert.doesNotMatch(document.body.textContent ?? '', /sensitive server detail/);
  assert.ok(document.querySelector('[role="alert"]'));
});

for (const status of [500, 503, 302]) {
  test(`Given a session answer with status ${status}, when the portal opens, then it shows the safe error`, async () => {
    const { document, options } = portal({ session: async () => new Response('failure', { status }) });
    await initializePortal(options);
    assert.match(document.body.textContent ?? '', /Failed to load your session/);
  });
}

test('Given a session answer without a form token, when the portal opens, then it shows the safe error and no sign-out form', async () => {
  const { document, options } = portal({ session: async () => Response.json({ signedIn: true, email: 'ada@example.com' }) });
  await initializePortal(options);
  assert.match(document.body.textContent ?? '', /Failed to load your session/);
  assert.equal(document.querySelector('form'), null);
});

test('Given a signed-in session, when the product access request fails, then the portal shows the safe error', async () => {
  const { document, options } = portal({ session: signedIn, 'portal/access': async () => new Response('failure', { status: 500 }) });
  await initializePortal(options);
  assert.match(document.body.textContent ?? '', /Failed to load your session/);
});

test('Given the portal, when it reads the session and the product access, then it sends only same-origin JSON reads with the relative paths of the server', async () => {
  const { options, requests } = portal({ session: signedIn, 'portal/access': async () => Response.json({ organizationId: 'org_01A', roles: ['user'], plan: 'free', mcpUrl: 'https://thermus.example/mcp' }) });
  await initializePortal(options);
  assert.deepEqual(requests.map(({ path, init }) => [path, init.method ?? 'GET', init.credentials, init.body]), [
    ['session', 'GET', 'same-origin', undefined],
    ['portal/access', 'GET', 'same-origin', undefined],
  ]);
});

for (const mcpUrl of ['javascript:alert(1)', '<img src=x>', undefined]) {
  test(`Given an invalid MCP endpoint ${mcpUrl}, when access loads, then the portal shows a safe error`, async () => {
    const { document, options } = portal({ session: signedIn, 'portal/access': async () => Response.json({ organizationId: 'org_a', roles: ['user'], plan: 'free', mcpUrl }) });
    await initializePortal(options);
    assert.match(document.body.textContent ?? '', /Failed to load your session/);
    assert.equal(document.querySelector('a[href^="javascript:"]'), null);
  });
}

test('Given a portal under a public base path, when access is denied, then workspace selection returns to that portal', async () => {
  const { document, options } = portal({ session: signedIn, 'portal/access': async () => new Response(null, { status: 403 }) });
  Object.defineProperty(document, 'baseURI', { value: 'https://thermus.example/team/' });
  await initializePortal(options);
  assert.equal(document.querySelector('.workspace-selection')?.getAttribute('href'), 'organizations?return_to=%2Fteam%2F');
  assert.equal(document.querySelector('a[href="signup"]')?.getAttribute('href'), 'signup');
});
