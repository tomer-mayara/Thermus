import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import type { User } from '@workos-inc/authkit-js';
import { initializePortal } from '../../../src/user-portal/portal.ts';

async function openPortal(user: Record<string, string> | null, pathname = '/') {
  const { document } = parseHTML('<html><body><div id="app">Loading...</div></body></html>');
  const effects = { signIns: 0, signOuts: 0 };
  const authkit = {
    getUser: () => user,
    signIn: async () => { effects.signIns += 1; },
    signOut: async () => { effects.signOuts += 1; },
  };
  const profile: User | null = user ? {
    object: 'user', id: 'user_test', emailVerified: true, profilePictureUrl: null,
    externalId: undefined, lastSignInAt: null, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z',
    firstName: user.firstName ?? null, lastName: user.lastName ?? null, email: user.email ?? '',
  } : null;
  await initializePortal({
    container: document.getElementById('app'), pathname,
    clientId: 'client_test', redirectUri: 'http://localhost:5173/callback',
  }, async (clientId, options) => {
    assert.equal(clientId, 'client_test');
    assert.equal(options.redirectUri, 'http://localhost:5173/callback');
    return { ...authkit, getUser: () => profile };
  });
  return { document, effects };
}

test('Given a signed-out visitor, when Sign In is clicked, then the portal starts AuthKit sign-in', async () => {
  const { document, effects } = await openPortal(null);
  assert.match(document.body.textContent ?? '', /Welcome to Thermus/);
  assert.equal(effects.signIns, 0);
  document.getElementById('sign-in-btn')?.click();
  assert.equal(effects.signIns, 1);
});

test('Given an AuthKit user on the callback, when Sign Out is clicked, then the profile is shown and AuthKit ends the session', async () => {
  const { document, effects } = await openPortal({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }, '/callback');
  assert.match(document.body.textContent ?? '', /Welcome, Ada!.*Email: ada@example.com.*Name: Ada Lovelace/s);
  document.getElementById('sign-out-btn')?.click();
  assert.equal(effects.signOuts, 1);
});

test('Given an external sign-in at /login, when the portal opens, then AuthKit sign-in starts without a button click', async () => {
  const { effects } = await openPortal(null, '/login');
  assert.equal(effects.signIns, 1);
});

test('Given HTML in profile fields, when the portal shows the profile, then those fields remain text', async () => {
  const firstName = '<img src=x onerror="alert(1)">';
  const { document } = await openPortal({ firstName, lastName: '<script>alert(1)</script>', email: '<b>ada@example.com</b>' });
  assert.ok(document.querySelector('img, script, b') === null, 'Profile fields must not create HTML elements');
  assert.ok(document.body.textContent?.includes(firstName));
  assert.ok(document.body.textContent?.includes('<b>ada@example.com</b>'));
});
