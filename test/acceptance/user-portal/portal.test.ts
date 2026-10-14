import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { initializePortal } from '../../../src/user-portal/portal.ts';

// A double of the server on the same origin: the session JSON, the product access, and the sign-in and sign-out routes.
interface ServerState {
  readonly session?: Readonly<Record<string, unknown>>;
  readonly productAccess?: Readonly<Record<string, unknown>>;
}

async function openPortal(server: ServerState) {
  const { document } = parseHTML('<html><body><div id="app">Loading...</div></body></html>');
  const navigations: string[] = [];
  const requests: string[] = [];
  await initializePortal({
    container: document.getElementById('app'),
    fetch: async (path) => {
      requests.push(path);
      if (path === 'session') return server.session ? Response.json(server.session) : Response.json({ signedIn: false }, { status: 401 });
      if (path === 'portal/access') return server.productAccess ? Response.json(server.productAccess) : new Response('<p>Access denied</p>', { status: 403 });
      return new Response('Not Found', { status: 404 });
    },
    navigate: (path) => navigations.push(path),
  });
  return { document, navigations, requests };
}

const ada = { signedIn: true, email: 'ada@example.com', name: 'Ada Lovelace', organizationId: 'org_01ACME', mfaCompleted: true, csrfToken: 'csrf-of-the-session' };

test('Given a signed-out visitor, when Sign In is clicked, then the portal sends the browser to the sign-in route of the server', async () => {
  const { document, navigations, requests } = await openPortal({});
  assert.match(document.body.textContent ?? '', /Welcome to Thermus.*Please sign in to continue/s);
  assert.deepEqual(navigations, []);
  document.getElementById('sign-in-btn')?.click();
  assert.deepEqual(navigations, ['login']);
  assert.deepEqual(requests, ['session'], 'A signed-out visitor makes no protected request');
});

test('Given a signed-in user with User access, when the portal opens, then it shows the server profile and the product access of the current organization, and Sign Out posts the session form token to the sign-out route', async () => {
  const { document } = await openPortal({ session: ada, productAccess: { organizationId: 'org_01ACME', roles: ['admin', 'user'] } });
  assert.match(document.body.textContent ?? '', /Welcome, Ada Lovelace!.*Email: ada@example.com.*Name: Ada Lovelace/s);
  assert.match(document.body.textContent ?? '', /You have product access in organization org_01ACME\. Roles: admin, user\./);
  const form = document.querySelector('form');
  assert.equal(form?.getAttribute('method'), 'post');
  assert.equal(form?.getAttribute('action'), 'logout');
  assert.deepEqual([...document.querySelectorAll('form input')].map((input) => [input.getAttribute('type'), input.getAttribute('name'), (input as HTMLInputElement).value]), [
    ['hidden', 'csrf_token', 'csrf-of-the-session'],
  ]);
});

test('Given a signed-in user whose current grants do not include User, when the portal opens, then it shows no product access and links to the organization page', async () => {
  const { document } = await openPortal({ session: { ...ada, name: undefined } });
  assert.match(document.body.textContent ?? '', /Welcome, ada@example.com!/);
  assert.match(document.body.textContent ?? '', /Your account has no product access in the selected organization\./);
  assert.equal(document.querySelector('.product-access a')?.getAttribute('href'), 'organizations');
  assert.doesNotMatch(document.body.textContent ?? '', /You have product access/);
});

test('Given HTML in the profile fields of the server, when the portal shows the profile, then those fields remain text', async () => {
  const name = '<img src=x onerror="alert(1)">';
  const { document } = await openPortal({ session: { ...ada, name, email: '<b>ada@example.com</b>' }, productAccess: { organizationId: '<script>alert(1)</script>', roles: ['<i>user</i>'] } });
  assert.equal(document.querySelector('img, script, b, i'), null, 'Server values must not create HTML elements');
  assert.ok(document.body.textContent?.includes(name));
  assert.ok(document.body.textContent?.includes('<b>ada@example.com</b>'));
});
