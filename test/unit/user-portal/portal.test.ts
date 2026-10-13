import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { initializePortal } from '../../../src/user-portal/portal.ts';

function options() {
  const { document } = parseHTML('<html><body><div id="app">Loading...</div></body></html>');
  return {
    container: document.getElementById('app'), pathname: '/',
    clientId: 'client_test', redirectUri: 'http://localhost:5173/callback',
  };
}

for (const field of ['clientId', 'redirectUri'] as const) {
  test(`Missing ${field} shows an error before the SDK is called`, async () => {
    const input = { ...options(), [field]: undefined };
    await initializePortal(input, async () => assert.fail('SDK must not receive missing configuration'));
    assert.match(input.container?.textContent ?? '', /Authentication Error.*Failed to initialize authentication/s);
    assert.ok(input.container?.querySelector('[role="alert"]'));
  });
}

test('A missing portal root does not start authentication', async () => {
  await initializePortal({ ...options(), container: null }, async () => assert.fail('SDK must not run without a root'));
});

test('An initialization rejection shows a safe error without the provider message', async () => {
  const input = options();
  await initializePortal(input, async () => { throw new Error('sensitive provider detail'); });
  assert.match(input.container?.textContent ?? '', /Failed to initialize authentication/);
  assert.doesNotMatch(input.container?.textContent ?? '', /sensitive provider detail/);
});

test('A rejected button sign-in shows an authentication error', async () => {
  const input = options();
  await initializePortal(input, async () => ({
    getUser: () => null,
    signIn: async () => { throw new Error('provider failure'); },
    signOut: async () => {},
  }));
  input.container?.querySelector<HTMLButtonElement>('#sign-in-btn')?.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(input.container?.textContent ?? '', /Failed to sign in/);
});

test('A rejected initiate login shows an authentication error', async () => {
  const input = { ...options(), pathname: '/login' };
  await initializePortal(input, async () => ({
    getUser: () => assert.fail('Initiate login must not read a profile'),
    signIn: async () => { throw new Error('provider failure'); },
    signOut: async () => {},
  }));
  assert.match(input.container?.textContent ?? '', /Failed to initialize authentication/);
});
