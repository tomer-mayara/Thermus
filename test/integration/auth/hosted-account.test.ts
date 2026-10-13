import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeHostedApplication } from '../../../src/application.ts';
import type { AuthenticatedUser, RequestContext, RoleGrant } from '../../../src/auth/access-context.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import type { BrowserSessionState } from '../../../src/hosted-admin/browser-session.ts';
import { AccountOperationProbe } from '../../support/account-operation-probe.ts';
import { MembershipDirectoryDouble, type MembershipRecord } from '../../support/membership-directory-double.ts';
import { BrowserSessionDouble } from '../../unit/hosted-admin/fixtures/browser-session-double.ts';

// No WorkOS setting, SDK, or credential: the hosted composition gets its provider roles as doubles.
const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://magumagu.example/team' }, 'http');
const authority = 'hosted-provider-double';
const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const superAdminGrant: RoleGrant = { role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] };
const operationPermissions = new Map([
  ['/team/account', 'product:access'],
  ['/team/organizations/grants', 'user-grants:manage'],
  ['/team/billing/seats', 'billing:manage'],
]);

// Each browser session has its own selected organization. cy has one session for each of its two organizations.
const sessions: ReadonlyArray<[string, string, string | undefined]> = [
  ['ann', 'user-ann', 'org-a'], ['ben', 'user-ben', 'org-b'], ['cy-a', 'user-cy', 'org-a'], ['cy-b', 'user-cy', 'org-b'],
  ['dee', 'user-dee', 'org-a'], ['eve', 'user-eve', 'org-a'], ['fay', 'user-fay', 'org-a'], ['gus', 'user-gus', undefined],
  ['hal', 'user-hal', 'org-a'], ['mallory', 'user-ann', 'org-a'],
];
const memberships: readonly MembershipRecord[] = [
  member('user-ann', 'org-a', [userGrant]),
  member('user-ben', 'org-b', [userGrant, adminGrant]),
  member('user-cy', 'org-a', [userGrant, adminGrant]),
  member('user-cy', 'org-b', [userGrant]),
  member('user-dee', 'org-a', [superAdminGrant]),
  member('user-eve', 'org-a', [adminGrant]),
  member('user-fay', 'org-a', [userGrant, adminGrant]),
  member('user-gus', 'org-a', [userGrant]),
  { ...member('user-hal', 'org-a', [userGrant, adminGrant]), active: false },
];

function member(subject: string, organizationId: string, grants: readonly RoleGrant[]): MembershipRecord {
  return { subject, organizationId, active: true, grants };
}

function userOf(subject: string, selectedOrganizationId?: string): AuthenticatedUser {
  return { authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) };
}

function serve() {
  const sessionStates = new Map(sessions.map(([name, subject, organizationId]): [string, BrowserSessionState] => [
    `session=${name}`,
    { status: 'signed-in', user: name === 'mallory' ? { ...userOf(subject, organizationId), authority: 'forged-authority' } : userOf(subject, organizationId) },
  ]));
  const session = new BrowserSessionDouble(sessionStates);
  const directory = new MembershipDirectoryDouble(authority, memberships);
  const probe = new AccountOperationProbe(operationPermissions);
  const application = composeHostedApplication(config, { session, accessResolver: directory }, probe.operation);
  return { application, session, directory, probe };
}

function accountGet(session: string, path = 'account', headers: Readonly<Record<string, string>> = {}): Request {
  return new Request(new URL(path, config.publicBaseUrl), { headers: { Cookie: `session=${session}`, ...headers } });
}

function formPost(session: string, path: string, form: Readonly<Record<string, string>>): Request {
  return new Request(new URL(path, config.publicBaseUrl), {
    method: 'POST',
    headers: { Cookie: `session=${session}`, 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://magumagu.example', 'X-Organization-Id': 'org-b' },
    body: new URLSearchParams(form).toString(),
  });
}

async function contextOf(response: Response): Promise<RequestContext> {
  assert.equal(response.status, 200);
  return ((await response.json()) as { context: RequestContext }).context;
}

describe('Hosted account routes with session and membership directory doubles', () => {
  test('Given members of two organizations and one user with a session in each, when their account requests overlap and resolve in reverse order, also with forged organization IDs in the query, headers, and form, then each operation works only in the organization that its own session selected', async () => {
    const { application, directory, probe } = serve();
    const releaseAnn = directory.hold('user-ann', 'org-a');

    const annAnswer = application.handle(accountGet('ann', 'account?organizationId=org-b', { 'X-Organization-Id': 'org-b' }));
    const others = await Promise.all([
      application.handle(accountGet('ben')),
      application.handle(formPost('cy-a', 'organizations/grants', { organizationId: 'org-b', userId: 'user-ben', role: 'admin' })),
      application.handle(formPost('cy-b', 'organizations/grants', { organizationId: 'org-a', userId: 'user-ann', role: 'admin' })),
    ]);
    releaseAnn();
    const ann = await contextOf(await annAnswer);
    const [ben, cyInA] = await Promise.all([contextOf(others[0] as Response), contextOf(others[1] as Response)]);

    assert.deepEqual([ann.organizationId, ann.tenantId, ann.user], ['org-a', 'hosted:org-a', userOf('user-ann', 'org-a')]);
    assert.deepEqual([ben.organizationId, ben.tenantId], ['org-b', 'hosted:org-b']);
    assert.deepEqual([cyInA.organizationId, cyInA.permissions], ['org-a', ['product:access', 'user-grants:manage']]);
    assert.equal(others[2]?.status, 403, 'cy has no Admin grant in the organization of its second session');
    assert.deepEqual(probe.work.slice(0, 2).sort((first, second) => first.subject.localeCompare(second.subject)), [
      { path: '/team/account', subject: 'user-ben', tenantId: 'hosted:org-b', organizationId: 'org-b' },
      { path: '/team/organizations/grants', subject: 'user-cy', tenantId: 'hosted:org-a', organizationId: 'org-a' },
    ]);
    assert.deepEqual(probe.work.slice(2), [{ path: '/team/account', subject: 'user-ann', tenantId: 'hosted:org-a', organizationId: 'org-a' }]);
  });

  test('Given independent Super Admin, Admin, and User plus Admin grants, when each user requests product, User-grant, and billing operations, then each context holds every grant and only the union of their explicit permissions, and each operation needs its own permission', async () => {
    const { application, probe } = serve();
    const requests = (session: string) => [
      accountGet(session),
      formPost(session, 'organizations/grants', { userId: 'user-ann', role: 'user' }),
      formPost(session, 'billing/seats', { seatCount: '5' }),
    ];

    const statuses: Record<string, number[]> = {};
    for (const session of ['dee', 'eve', 'fay']) {
      statuses[session] = [];
      for (const request of requests(session)) statuses[session].push((await application.handle(request)).status);
    }
    const fay = await contextOf(await application.handle(accountGet('fay')));

    assert.deepEqual(statuses, { dee: [403, 403, 200], eve: [403, 200, 403], fay: [200, 200, 403] });
    assert.deepEqual(fay.grants, [userGrant, adminGrant]);
    assert.deepEqual(fay.permissions, ['product:access', 'user-grants:manage']);
    assert.deepEqual(probe.work.map(({ subject, path }) => `${subject} ${path}`), [
      'user-dee /team/billing/seats',
      'user-eve /team/organizations/grants',
      'user-fay /team/account',
      'user-fay /team/organizations/grants',
      'user-fay /team/account',
    ]);
  });

  test('Given a session without a selected organization, an inactive membership, an identity of another authority, and no session, when they request account operations, then each is refused before any operation, with no default organization, tenant, or role', async () => {
    const { application, directory, probe } = serve();

    const statuses = [];
    for (const request of [accountGet('gus'), accountGet('hal'), accountGet('mallory'), accountGet('unknown')]) {
      statuses.push((await application.handle(request)).status);
    }

    assert.deepEqual(statuses, [403, 403, 403, 401]);
    assert.deepEqual(directory.calls.map(({ subject }) => subject), ['user-gus', 'user-hal', 'user-ann']);
    assert.deepEqual(probe.work, []);
  });

  test('Given the composition with session and directory doubles, when an MCP request or a path outside the public URL arrives, then the MCP resource still answers that hosted authentication is not available and the other path gives 404, without a session lookup', async () => {
    const { application, session } = serve();

    const mcp = await application.handle(new Request(config.mcpResourceUrl, { method: 'POST', headers: { Cookie: 'session=ann', Authorization: 'Bearer forged-token' } }));
    const outside = await application.handle(new Request('https://magumagu.example/account', { headers: { Cookie: 'session=ann' } }));

    assert.equal(mcp.status, 503);
    assert.deepEqual(await mcp.json(), { error: 'temporarily_unavailable', error_description: 'Hosted authentication is not available yet.' });
    assert.equal(outside.status, 404);
    assert.deepEqual(session.calls, []);
  });
});
