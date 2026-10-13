import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HttpAgent, loopbackRedirectUri } from './better-auth-agents.js';
import { withRegistrationSession } from './better-auth-local.js';
import { assertExit, runCommand } from './command-process.js';
import { selfHostedSettings } from './local-runtime.js';
export function operatorOn(t, directory) {
    return (args, input = []) => runCommand(t, selfHostedSettings(directory), { args, input });
}
export function addUser(operator, account) {
    return operator(['users', 'add', account.email], [account.password, account.password]);
}
export function registerArgs(account, redirectUris = [loopbackRedirectUri]) {
    return ['clients', 'register', '--user', account.email, '--name', 'Native MCP client', ...redirectUris.flatMap((uri) => ['--redirect-uri', uri])];
}
export function registeredClientId(result) {
    assertExit(result, 0);
    const clientId = /client ID (\S+)\./.exec(result.stdout)?.[1];
    assert.ok(clientId, `the registration reported no client ID:\n${result.stdout}`);
    return clientId;
}
export async function listedAccounts(operator) {
    const listing = await operator(['users', 'list']);
    assertExit(listing, 0);
    if (/^No local accounts/.test(listing.stdout))
        return [];
    const [header, ...rows] = listing.stdout.trimEnd().split('\n');
    assert.deepEqual(header?.trim().split(/\s+/), ['EMAIL', 'STATE', 'ID']);
    return rows.map((row) => {
        const [email = '', state = '', id = '', ...rest] = row.trim().split(/\s+/);
        assert.deepEqual(rest, [], `the list shows more than email, state, and ID: ${row}`);
        return { email, state, id };
    });
}
export async function signIn(auth, account) {
    return new HttpAgent(auth).signIn(account.email, account.password);
}
export async function signedInUserId(auth, account) {
    const response = await signIn(auth, account);
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).user.id;
}
// clients register keeps the resource-server client of the installation in this file, and only the owner can read it.
export function storedResourceServerClient(directory) {
    const file = join(directory, 'resource-server-client.json');
    assert.equal(statSync(file).mode & 0o777, 0o600, 'the resource-server client file is owner-only');
    const stored = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(stored), ['clientId', 'clientSecret', 'resource']);
    return stored;
}
// Introspection needs a confidential resource-server client. This registers another one through the provider,
// for a test without the client that clients register keeps in the data directory.
export async function resourceServerClient(auth, account) {
    const client = await withRegistrationSession(auth, account, (headers) => auth.api.adminCreateOAuthClient({
        headers,
        body: { client_name: 'Test resource server', token_endpoint_auth_method: 'client_secret_basic', grant_types: ['client_credentials'] },
    }));
    assert.ok(client.client_secret, 'a confidential client receives a secret');
    return { clientId: client.client_id, clientSecret: client.client_secret };
}
export async function userGrant(auth, native, account) {
    const browser = new HttpAgent(auth);
    const response = await browser.signIn(account.email, account.password);
    assert.equal(response.status, 200, await response.clone().text());
    const { user } = await response.json();
    return { id: user.id, browser, accessToken: (await native.authorize(browser)).access_token };
}
//# sourceMappingURL=local-commands.js.map