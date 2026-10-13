import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeHostedApplication } from '../../../src/application.ts';
import type { AuthenticatedUser, RequestContext, RoleGrant } from '../../../src/auth/access-context.ts';
import { BillingFree } from '../../../src/billing/billing-free.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import type { BrowserSessionState } from '../../../src/auth/hosted-auth/browser-session.ts';
import { AccountOperationProbe } from '../../support/account-operation-probe.ts';
import { MembershipDirectoryDouble, type MembershipRecord } from '../../support/membership-directory-double.ts';
import { BrowserSessionDouble, SignedInSessionDouble } from '../../unit/hosted-admin/fixtures/browser-session-double.ts';

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
  return { subject, organizationId, organizationName: `Organization ${organizationId}`, active: true, grants };
}

function userOf(subject: string, selectedOrganizationId?: string): AuthenticatedUser {
  return { authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) };
}

class McpEndpointDouble {
  readonly requests: Request[] = [];
  closes = 0;

  async fetch(request: Request): Promise<Response> {
    this.requests.push(request);
    return new Response('MCP endpoint double');
  }

  async close(): Promise<void> {
    this.closes += 1;
  }
}

function serve() {
  const sessionStates = new Map(sessions.map(([name, subject, organizationId]): [string, BrowserSessionState] => [
    `session=${name}`,
    new SignedInSessionDouble(name === 'mallory' ? { ...userOf(subject, organizationId), authority: 'forged-authority' } : userOf(subject, organizationId)),
  ]));
  const session = new BrowserSessionDouble(sessionStates);
  const directory = new MembershipDirectoryDouble(authority, memberships);
  const probe = new AccountOperationProbe(operationPermissions);
  const mcp = new McpEndpointDouble();
  const account = { reportFailure: () => {}, changeRecords: { record: () => {} }, billing: new BillingFree(), operation: probe.operation };
  const application = composeHostedApplication(config, { session, accessResolver: directory, organizations: directory, mcp }, account);
  return { application, session, directory, probe, mcp };
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

async function outcomeOf(response: Response): Promise<string> {
  if (response.status === 200) return 'done';
  const { refused } = (await response.json()) as { refused: string };
  return `refused ${refused}`;
}

async function contextOf(response: Response): Promise<RequestContext> {
  assert.equal(response.status, 200);
  return ((await response.json()) as { context: RequestContext }).context;
}

describe('Hosted account routes with session and membership directory doubles and no WorkOS setting', () => {
  test('Given members of two organizations and one user with a session in each, when their account requests overlap and resolve in reverse order, also with forged organization IDs in the query, headers, and form, then each operation works only in the organization that its own session selected', async () => {
    const { application, directory, probe } = serve();
    const resumeAnn = directory.pauseResolution('user-ann', 'org-a');

    const annAnswer = application.handle(accountGet('ann', 'account?organizationId=org-b', { 'X-Organization-Id': 'org-b' }));
    const others = await Promise.all([
      application.handle(accountGet('ben')),
      application.handle(formPost('cy-a', 'organizations/grants', { organizationId: 'org-b', userId: 'user-ben', role: 'admin' })),
      application.handle(formPost('cy-b', 'organizations/grants', { organizationId: 'org-a', userId: 'user-ann', role: 'admin' })),
    ]);
    resumeAnn();
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

    const outcomes: Record<string, string[]> = {};
    for (const session of ['dee', 'eve', 'fay']) {
      outcomes[session] = [];
      for (const request of requests(session)) outcomes[session].push(await outcomeOf(await application.handle(request)));
    }
    const fay = await contextOf(await application.handle(accountGet('fay')));

    const refused = 'refused permission-required';
    assert.deepEqual(outcomes, { dee: [refused, refused, 'done'], eve: [refused, 'done', refused], fay: ['done', 'done', refused] });
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

    const answers = [];
    for (const request of [accountGet('gus'), accountGet('hal'), accountGet('mallory'), accountGet('unknown')]) {
      const response = await application.handle(request);
      answers.push([response.status, response.headers.get('Content-Type')]);
    }

    const page = 'text/html; charset=utf-8';
    assert.deepEqual(answers, [[403, page], [403, page], [403, page], [401, page]]);
    assert.deepEqual(directory.calls.map(({ subject }) => subject), ['user-gus', 'user-hal', 'user-ann']);
    assert.deepEqual(probe.work, []);
  });

  test('Given the composition with an MCP endpoint double, when MCP and metadata requests and a path outside the public URL arrive and the application closes two times, then the endpoint gets each MCP request without a browser session lookup, the other path gives 404, and the endpoint closes one time', async () => {
    const { application, session, mcp } = serve();
    const requests = [
      new Request(config.mcpResourceUrl, { method: 'POST', headers: { Cookie: 'session=ann', Authorization: 'Bearer forged-token' } }),
      new Request(config.resourceMetadataUrl),
    ];

    const answers = await Promise.all(requests.map(async (request) => (await application.handle(request)).text()));
    const outside = await application.handle(new Request('https://magumagu.example/account', { headers: { Cookie: 'session=ann' } }));
    await Promise.all([application.close(), application.close()]);

    assert.deepEqual(answers, ['MCP endpoint double', 'MCP endpoint double']);
    assert.deepEqual(mcp.requests, requests);
    assert.equal(outside.status, 404);
    assert.deepEqual([session.calls, mcp.closes], [[], 1]);
  });
});
