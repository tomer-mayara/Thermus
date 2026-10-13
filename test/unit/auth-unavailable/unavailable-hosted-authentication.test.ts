import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AuthenticatedUser } from '../../../src/auth/access-context.ts';
import { UnavailableHostedAuthentication, UnavailableMcpEndpoint } from '../../../src/auth-unavailable/unavailable-hosted-authentication.ts';
import { mcpUnavailableAnswer } from '../../support/hosted-placeholder.ts';

const resourceUrl = 'https://magumagu.example/mcp';
const forgedCookies = [
  null,
  '',
  'wos-session=Fe26.2*forged-sealed-session',
  'better-auth.session_token=forged-local-session; organizationId=org_01FORGED',
];
const anyUsers: readonly AuthenticatedUser[] = [
  { authority: 'workos:client_placeholder', subject: 'user_01FORGED', selectedOrganizationId: 'org_01FORGED' },
  { authority: 'workos:client_placeholder', subject: 'user_01FORGED' },
  { authority: 'better-auth:local-installation', subject: 'local-user' },
];

function mcpRequests(): Request[] {
  const call = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetch', arguments: { organizationId: 'org_01FORGED' } } });
  const json = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  return [
    new Request(resourceUrl, { method: 'POST', headers: { ...json, Authorization: 'Bearer forged-connect-token' }, body: call }),
    new Request(resourceUrl, { method: 'POST', headers: { ...json, Cookie: 'wos-session=forged-sealed-session' }, body: call }),
    new Request(resourceUrl, { headers: { Accept: 'text/event-stream', Authorization: 'Bearer forged-connect-token' } }),
    new Request(resourceUrl, { method: 'DELETE', headers: { 'Mcp-Session-Id': 'forged-session-id' } }),
    new Request('https://magumagu.example/.well-known/oauth-protected-resource/mcp'),
  ];
}

describe('UnavailableHostedAuthentication', () => {
  test('Given any Cookie header, also a forged session or organization cookie, when the browser session is authenticated, then hosted authentication is unavailable and no user is given', async () => {
    const authentication = new UnavailableHostedAuthentication();

    const states = await Promise.all(forgedCookies.map((cookie) => authentication.authenticate(cookie)));

    assert.deepEqual(states, forgedCookies.map(() => ({ status: 'unavailable' })));
  });

  test('Given any user, also one with a selected organization, when access is resolved, then access is denied and no context, tenant, or grant is given', async () => {
    const authentication = new UnavailableHostedAuthentication();

    const decisions = await Promise.all(anyUsers.map((user) => authentication.resolve(user)));

    assert.deepEqual(decisions, anyUsers.map(() => ({ allowed: false, reason: 'account-inactive' })));
  });

  test('Given any user, also one with a selected organization, when its organization memberships are read, then no membership, organization, or grant is given', async () => {
    const authentication = new UnavailableHostedAuthentication();

    const memberships = await Promise.all(anyUsers.map((user) => authentication.membershipsOf(user)));

    assert.deepEqual(memberships, anyUsers.map(() => []));
    assert.ok(memberships.every((list) => Object.isFrozen(list)));
  });

  test('Given any organization, membership, or invitation ID, when the administration reads run, then no member or invitation is given, and the invitation policy claims no strict address match', async () => {
    const authentication = new UnavailableHostedAuthentication();

    const pages = [
      await authentication.memberPage({ organizationId: 'org_01FORGED', statuses: ['active', 'inactive', 'pending'] }),
      await authentication.memberPage({ organizationId: 'org_01FORGED', statuses: ['active'], cursor: 'forged-cursor' }),
      await authentication.invitationPage({ organizationId: 'org_01FORGED', states: ['pending', 'accepted', 'revoked', 'expired'] }),
    ];
    const records = [await authentication.member('om_01FORGED'), await authentication.invitation('invitation_01FORGED')];

    assert.deepEqual(pages, pages.map(() => ({ items: [] })));
    assert.ok(pages.every((page) => Object.isFrozen(page) && Object.isFrozen(page.items)));
    assert.deepEqual(records, [undefined, undefined]);
    assert.equal(authentication.invitationIdentityPolicy, 'provider-rules');
  });

  test('Given any grant or invitation change, also for a forged organization, membership, or invitation, when it is requested, then the placeholder changes nothing and answers that it cannot make the change safely', async () => {
    const authentication = new UnavailableHostedAuthentication();

    const answers = [
      await authentication.changeGrant({ membershipId: 'om_01FORGED', role: 'admin', action: 'grant', revision: 'r1' }),
      await authentication.changeGrant({ membershipId: 'om_01FORGED', role: 'user', action: 'revoke', revision: 'r1' }),
      await authentication.sendInvitation({ organizationId: 'org_01FORGED', email: 'eve@example.com', role: 'admin' }),
      await authentication.resendInvitation('invitation_01FORGED'),
      await authentication.revokeInvitation('invitation_01FORGED'),
    ];

    assert.deepEqual(answers, answers.map(() => ({ outcome: 'unsupported' })));
    assert.ok(answers.every((answer) => Object.isFrozen(answer)));
    assert.deepEqual(await authentication.memberPage({ organizationId: 'org_01FORGED', statuses: ['active'] }), { items: [] });
  });
});

describe('UnavailableMcpEndpoint', () => {
  test('Given any MCP or metadata request, also with a forged bearer token, cookie, or organization value, when it arrives, then it gets 503 temporarily_unavailable that no one may store, with no Bearer challenge and no cookie, and its body stays unread', async () => {
    const endpoint = new UnavailableMcpEndpoint();
    const requests = mcpRequests();

    for (const request of requests) {
      const response = await endpoint.fetch(request);
      assert.equal(response.status, 503);
      assert.deepEqual([response.headers.get('Cache-Control'), response.headers.get('WWW-Authenticate'), response.headers.get('Set-Cookie')], ['no-store', null, null]);
      assert.match(response.headers.get('Content-Type') ?? '', /^application\/json/);
      assert.deepEqual(await response.json(), mcpUnavailableAnswer);
    }

    assert.deepEqual(requests.map(({ bodyUsed }) => bodyUsed), requests.map(() => false));
  });

  test('Given the endpoint, when it closes two times, then each close succeeds', async () => {
    const endpoint = new UnavailableMcpEndpoint();

    await endpoint.close();
    await endpoint.close();
  });
});
