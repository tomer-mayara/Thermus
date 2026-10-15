import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  errorCodeOf,
  followAuthorizationWithConsent,
  HttpAgent,
  PreRegisteredNativeClient,
  ResourceServerClient,
} from '../../support/drivers/browser/better-auth-agents.ts';
import type { AccountCredentials, LocalAuth } from '../../support/in-process/better-auth-local.ts';
import { assertExit, assertRevealsNone } from '../../support/command-process.ts';
import { dataDirectory } from '../../support/data-directory.ts';
import {
  addUser,
  listedAccounts,
  operatorOn,
  registerArgs,
  registeredClientId,
  resourceServerClient,
  signedInUserId,
  signIn,
  userGrant,
  type Operator,
  type ResourceServerCredentials,
  type UserGrant,
} from '../../support/local-commands.ts';
import { selfHostedServerSettings, withRuntime } from '../../support/in-process/local-runtime.ts';
import { ServerProcess } from '../../support/server-process.ts';

const alice: AccountCredentials = { email: 'alice@example.com', password: 'alice-password-1' };
const bob: AccountCredentials = { email: 'bob@example.com', password: 'bob-password-1' };
const lockError = /in use by another Thermus process/;

interface Grants {
  readonly resourceServer: ResourceServerCredentials;
  readonly nativeClientId: string;
  readonly alice: UserGrant;
  readonly bob: UserGrant;
  readonly bobPendingCode: { readonly callback: string; readonly verifier: string };
}

async function grantsThrough(auth: LocalAuth, nativeClientId: string): Promise<Grants> {
  const resourceServer = await resourceServerClient(auth, alice);
  const native = new PreRegisteredNativeClient(auth, nativeClientId);
  const aliceGrant = await userGrant(auth, native, alice);
  const bobGrant = await userGrant(auth, native, bob);
  const pending = native.authorizationRequest();
  const callback = await followAuthorizationWithConsent(bobGrant.browser, pending.path);
  const introspection = new ResourceServerClient(auth, resourceServer.clientId, resourceServer.clientSecret);
  for (const { accessToken } of [aliceGrant, bobGrant]) assert.equal((await introspection.introspect(accessToken)).active, true);
  return { resourceServer, nativeClientId, alice: aliceGrant, bob: bobGrant, bobPendingCode: { callback: callback.href, verifier: pending.verifier } };
}

async function twoUsersWithGrants(operator: Operator, directory: string): Promise<Grants> {
  for (const account of [alice, bob]) assertExit(await addUser(operator, account), 0);
  const nativeClientId = registeredClientId(await operator(registerArgs(alice), [alice.password]));
  return withRuntime(directory, ({ auth }) => grantsThrough(auth, nativeClientId));
}

function mcpPost(): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} }),
  };
}

describe('Offline local user and client commands', () => {
  test('Given a stopped server and its data directory, when the operator adds users with hidden passwords and lists them, then a duplicate email is refused, the list shows each enabled state without credentials, the new password signs in, and no command uses the network', { timeout: 120_000 }, async (t) => {
    const directory = dataDirectory(t);
    const operator = operatorOn(t, directory);
    const server = await ServerProcess.start(t, selfHostedServerSettings(directory));
    const tenant = server.tenant();
    await server.stop();

    const added = [await addUser(operator, alice), await addUser(operator, bob)];
    const duplicate = await operator(['users', 'add', 'ALICE@Example.com'], ['other-password-1', 'other-password-1']);
    const accounts = await listedAccounts(operator);

    for (const result of added) assertExit(result, 0);
    assertExit(duplicate, 1);
    assert.match(duplicate.stderr, /already exists/);
    assert.deepEqual(accounts.map(({ email, state }) => ({ email, state })), [
      { email: 'alice@example.com', state: 'enabled' },
      { email: 'bob@example.com', state: 'enabled' },
    ]);
    assertRevealsNone([...added, duplicate], [alice.password, bob.password, 'other-password-1']);
    await withRuntime(directory, async ({ auth }) => {
      assert.equal(await signedInUserId(auth, alice), accounts[0]?.id);
      assert.equal(await signedInUserId(auth, bob), accounts[1]?.id);
      const other = await signIn(auth, { email: alice.email, password: 'other-password-1' });
      assert.equal(other.status, 401);
    });
    const restarted = await ServerProcess.start(t, selfHostedServerSettings(directory));
    assert.equal(restarted.tenant(), tenant);
    await restarted.stop();
  });

  test('Given two enabled users with browser sessions and MCP access tokens, when reset-password targets one user, then only that user\'s old password, session, and token fail; its ID and enabled state stay; its new password works; and the peer stays usable', { timeout: 120_000 }, async (t) => {
    const directory = dataDirectory(t);
    const operator = operatorOn(t, directory);
    const grants = await twoUsersWithGrants(operator, directory);
    const before = await listedAccounts(operator);

    const reset = await operator(['users', 'reset-password', alice.email], ['alice-password-2', 'alice-password-2']);

    assertExit(reset, 0);
    assertRevealsNone([reset], [alice.password, 'alice-password-2']);
    assert.deepEqual(await listedAccounts(operator), before);
    await withRuntime(directory, async ({ auth }) => {
      const introspection = new ResourceServerClient(auth, grants.resourceServer.clientId, grants.resourceServer.clientSecret);
      assert.equal((await signIn(auth, alice)).status, 401);
      assert.equal(await signedInUserId(auth, { email: alice.email, password: 'alice-password-2' }), grants.alice.id);
      assert.equal(await new HttpAgent(auth, grants.alice.browser.cookies).sessionId(), undefined);
      assert.deepEqual(await introspection.introspect(grants.alice.accessToken), { active: false });
      assert.ok(await new HttpAgent(auth, grants.bob.browser.cookies).sessionId(), 'the peer keeps its session');
      assert.equal((await introspection.introspect(grants.bob.accessToken)).active, true);
      assert.equal(await signedInUserId(auth, bob), grants.bob.id);
    });
  });

  test('Given two enabled users with sessions, MCP access tokens, and a pending authorization code, when disable targets one user, then that user cannot sign in, keeps its ID, and loses its session, token, pending code, new authorization, and refresh; the list shows it disabled; the peer stays usable', { timeout: 120_000 }, async (t) => {
    const directory = dataDirectory(t);
    const operator = operatorOn(t, directory);
    const grants = await twoUsersWithGrants(operator, directory);

    const disable = await operator(['users', 'disable', bob.email]);

    assertExit(disable, 0);
    assert.deepEqual(await listedAccounts(operator), [
      { email: alice.email, state: 'enabled', id: grants.alice.id },
      { email: bob.email, state: 'disabled', id: grants.bob.id },
    ]);
    await withRuntime(directory, async ({ auth }) => {
      const introspection = new ResourceServerClient(auth, grants.resourceServer.clientId, grants.resourceServer.clientSecret);
      const native = new PreRegisteredNativeClient(auth, grants.nativeClientId);
      const bobBrowser = new HttpAgent(auth, grants.bob.browser.cookies);
      const login = await signIn(auth, bob);
      assert.equal(login.status, 403);
      assert.equal(await errorCodeOf(login), 'BANNED_USER');
      assert.equal(await bobBrowser.sessionId(), undefined);
      assert.deepEqual(await introspection.introspect(grants.bob.accessToken), { active: false });
      const exchange = await native.exchange(new URL(grants.bobPendingCode.callback), grants.bobPendingCode.verifier);
      assert.equal(exchange.status, 400);
      const authorization = await bobBrowser.request('GET', native.authorizationRequest().path, { origin: null });
      assert.match(authorization.headers.get('Location') ?? '', /^\/sign-in\?/);
      const refresh = await native.refresh(grants.bob.accessToken);
      assert.equal(await errorCodeOf(refresh), 'unsupported_grant_type');
      assert.ok(await new HttpAgent(auth, grants.alice.browser.cookies).sessionId(), 'the peer keeps its session');
      assert.equal((await introspection.introspect(grants.alice.accessToken)).active, true);
      assert.equal(await signedInUserId(auth, alice), grants.alice.id);
    });
  });

  test('Given a live server, when each operator command runs in another process on its data directory, then each fails with the lock error, asks for no password, and changes nothing; after the server stops, add recovers the zero-account installation', { timeout: 120_000 }, async (t) => {
    const directory = dataDirectory(t);
    const operator = operatorOn(t, directory);
    const server = await ServerProcess.start(t, selfHostedServerSettings(directory));
    const tenant = server.tenant();

    const refused = [
      await operator(['users', 'add', alice.email], [alice.password, alice.password]),
      await operator(['users', 'list']),
      await operator(['users', 'reset-password', alice.email], [alice.password, alice.password]),
      await operator(['users', 'disable', alice.email]),
      await operator(registerArgs(alice), [alice.password]),
    ];
    const serving = await server.request('/mcp', mcpPost());
    await server.stop();

    for (const result of refused) {
      assertExit(result, 1);
      assert.match(result.stderr, lockError);
      assert.doesNotMatch(result.stderr, /password/i);
      assert.equal(result.stdout, '');
    }
    assert.equal(serving.status, 401);
    assert.deepEqual(await listedAccounts(operator), []);
    assertExit(await addUser(operator, alice), 0);
    const [account] = await listedAccounts(operator);
    assert.deepEqual({ email: account?.email, state: account?.state }, { email: alice.email, state: 'enabled' });
    await withRuntime(directory, async ({ auth }) => assert.equal(await signedInUserId(auth, alice), account?.id));
    const restarted = await ServerProcess.start(t, selfHostedServerSettings(directory));
    assert.equal(restarted.tenant(), tenant);
    await restarted.stop();
  });
});
