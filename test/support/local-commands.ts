import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { HttpAgent, loopbackRedirectUri, type PreRegisteredNativeClient } from './better-auth-agents.ts';
import { withRegistrationSession, type AccountCredentials, type LocalAuth } from './better-auth-local.ts';
import { assertExit, runCommand, type CommandResult } from './command-process.ts';
import { selfHostedSettings } from './local-runtime.ts';

export type Operator = (args: readonly string[], input?: readonly string[]) => Promise<CommandResult>;

export interface ListedAccount {
  readonly email: string;
  readonly state: string;
  readonly id: string;
}

export interface ResourceServerCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface StoredResourceServerClient extends ResourceServerCredentials {
  readonly resource: string;
}

export interface UserGrant {
  readonly id: string;
  readonly browser: HttpAgent;
  readonly accessToken: string;
}

export function operatorOn(t: TestContext, directory: string): Operator {
  return (args, input = []) => runCommand(t, selfHostedSettings(directory), { args, input });
}

export function addUser(operator: Operator, account: AccountCredentials): Promise<CommandResult> {
  return operator(['users', 'add', account.email], [account.password, account.password]);
}

export function registerArgs(account: AccountCredentials, redirectUris: readonly string[] = [loopbackRedirectUri]): string[] {
  return ['clients', 'register', '--user', account.email, '--name', 'Native MCP client', ...redirectUris.flatMap((uri) => ['--redirect-uri', uri])];
}

export function registeredClientId(result: CommandResult): string {
  assertExit(result, 0);
  const clientId = /client ID (\S+)\./.exec(result.stdout)?.[1];
  assert.ok(clientId, `the registration reported no client ID:\n${result.stdout}`);
  return clientId;
}

export async function listedAccounts(operator: Operator): Promise<ListedAccount[]> {
  const listing = await operator(['users', 'list']);
  assertExit(listing, 0);
  if (/^No local accounts/.test(listing.stdout)) return [];
  const [header, ...rows] = listing.stdout.trimEnd().split('\n');
  assert.deepEqual(header?.trim().split(/\s+/), ['EMAIL', 'STATE', 'ID']);
  return rows.map((row) => {
    const [email = '', state = '', id = '', ...rest] = row.trim().split(/\s+/);
    assert.deepEqual(rest, [], `the list shows more than email, state, and ID: ${row}`);
    return { email, state, id };
  });
}

export async function signIn(auth: LocalAuth, account: AccountCredentials): Promise<Response> {
  return new HttpAgent(auth).signIn(account.email, account.password);
}

export async function signedInUserId(auth: LocalAuth, account: AccountCredentials): Promise<string> {
  const response = await signIn(auth, account);
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json() as { user: { id: string } }).user.id;
}

// clients register keeps the resource-server client of the installation in this file, and only the owner can read it.
export function storedResourceServerClient(directory: string): StoredResourceServerClient {
  const file = join(directory, 'resource-server-client.json');
  assert.equal(statSync(file).mode & 0o777, 0o600, 'the resource-server client file is owner-only');
  const stored = JSON.parse(readFileSync(file, 'utf8')) as StoredResourceServerClient;
  assert.deepEqual(Object.keys(stored), ['clientId', 'clientSecret', 'resource']);
  return stored;
}

// Introspection needs a confidential resource-server client. This registers another one through the provider,
// for a test without the client that clients register keeps in the data directory.
export async function resourceServerClient(auth: LocalAuth, account: AccountCredentials): Promise<ResourceServerCredentials> {
  const client = await withRegistrationSession(auth, account, (headers) => auth.api.adminCreateOAuthClient({
    headers,
    body: { client_name: 'Test resource server', token_endpoint_auth_method: 'client_secret_basic', grant_types: ['client_credentials'] },
  }));
  assert.ok(client.client_secret, 'a confidential client receives a secret');
  return { clientId: client.client_id, clientSecret: client.client_secret };
}

export async function userGrant(auth: LocalAuth, native: PreRegisteredNativeClient, account: AccountCredentials): Promise<UserGrant> {
  const browser = new HttpAgent(auth);
  const response = await browser.signIn(account.email, account.password);
  assert.equal(response.status, 200, await response.clone().text());
  const { user } = await response.json() as { user: { id: string } };
  return { id: user.id, browser, accessToken: (await native.authorize(browser)).access_token };
}
