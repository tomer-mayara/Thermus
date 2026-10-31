import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gatewayTenantsOf } from '../../../src/app/mcp-gateway-composition.ts';
import { workspaceTenantsOf } from '../../../src/app/workspace-composition.ts';
import { WorkspaceStatuses } from '../../../src/interfaces/web/account/workspace-status.ts';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import { TenantActivity } from '../../../src/tenancy/tenants/tenant-activity.ts';
import { TenantLookup } from '../../../src/tenancy/tenants/tenant-lookup.ts';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import { TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { TenantResumes } from '../../../src/tenancy/tenants/tenant-resumes.ts';
import { TenantRegistryFake } from '../../support/doubles/tenants/tenant-registry-fake.ts';
import { TenantResumeSpy } from '../../support/doubles/tenants/tenant-resume-spy.ts';
import { accountRequest, adminGrant, allowedFor, ann, contextOf, serve, signedIn, userGrant, type Setup } from './fixtures/account-routes-fixtures.ts';

// GET workspace/status of SO-07 with the account routes and their real session and access rules, the workspace status
// of web, the port that app composes on the gateway port, and the real registry rules over an in-memory registry.

const settingUp = 'Setting up your workspace. This takes about two minutes.';
const userContext = contextOf(ann, [userGrant], userGrant.permissions);

function statusSite(options: { readonly context?: RequestContext; readonly freeTenantLimit?: number; readonly setup?: Setup } = {}) {
  const registry = new TenantRegistryFake();
  const clock = { now: 0 };
  const lookup = new TenantLookup(registry, () => clock.now);
  const requests = new TenantRequests(registry, options.freeTenantLimit ?? 25);
  const reports: string[] = [];
  const tenants = gatewayTenantsOf({ lookup, requests, resumes: new TenantResumes(registry, new TenantResumeSpy()), activity: new TenantActivity(registry, () => clock.now) });
  const workspaces = new WorkspaceStatuses(workspaceTenantsOf(tenants), (line) => reports.push(line));
  const site = serve({
    sessions: new Map([['session=ann', signedIn(ann)]]),
    decisions: new Map([[ann.subject, allowedFor(options.context ?? userContext)]]),
    workspaces,
    ...options.setup,
  });
  return { ...site, registry, reports, clock };
}

async function statusOf(site: ReturnType<typeof statusSite>, path = '/workspace/status', init: RequestInit = {}) {
  const answer = await site.routes.handle(accountRequest(path, 'session=ann', init));
  return { status: answer.status, headers: answer.headers, body: answer.headers.get('Content-Type') === 'application/json' ? await answer.json() as unknown : await answer.text() };
}

const rowViews: ReadonlyArray<readonly [TenantState, Record<string, unknown>]> = [
  ['requested', { ready: false, message: settingUp }],
  ['creating', { ready: false, message: settingUp }],
  ['deploying', { ready: false, message: settingUp }],
  ['live', { ready: true }],
  ['suspended', { ready: true }],
  ['failed', { ready: false, message: 'Workspace setup failed. We have been notified and will fix it.' }],
  ['deleted', { ready: false, message: 'Your workspace is not available. Contact Thermus support.' }],
];

for (const [state, view] of rowViews) {
  test(`Given a row in state ${state} and a User of the selected organization, when the portal reads the workspace status, then it gets the view of that state and no tenant request`, async () => {
    const site = statusSite();
    site.registry.set('org-a', { state, ...(state === 'live' || state === 'suspended' ? { internalUrl: 'http://thermus-tenant-org-a:8080', serviceId: 'srv-orga' } : {}) });

    const answer = await statusOf(site);

    assert.equal(answer.status, 200);
    assert.deepEqual(answer.body, { state, ...view });
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(site.registry.requests, []);
  });
}

test('Given an organization without a row, when the portal reads the workspace status, then the read requests the tenant and the answer is the setup state', async () => {
  const site = statusSite();

  const answer = await statusOf(site);

  assert.deepEqual(answer.body, { state: 'requested', ready: false, message: settingUp });
  assert.equal(site.registry.stateOf('org-a'), 'requested');
  assert.deepEqual(site.registry.inserts, ['org-a']);
});

test('Given an organization without a row and a full cap, when the portal reads the workspace status, then it gets the words of the full cap and no row', async () => {
  const site = statusSite({ freeTenantLimit: 0 });

  const answer = await statusOf(site);

  assert.deepEqual(answer.body, { state: 'full', ready: false, message: 'All free workspaces are in use. Try again later.' });
  assert.deepEqual(site.registry.requests, ['org-a']);
  assert.equal(site.registry.stateOf('org-a'), undefined);
});

test('Given a registry that cannot be read, when the portal reads the workspace status, then it gets the words of an unavailable service and no tenant request', async () => {
  const site = statusSite();
  site.registry.readFailure = true;

  const answer = await statusOf(site);

  assert.deepEqual(answer.body, { state: 'unavailable', ready: false, message: 'The service is temporarily unavailable. Try again in 15 seconds.' });
  assert.deepEqual(site.registry.requests, []);
});

test('Given an Admin, when the portal reads the workspace status with a query that names another organization, then the answer is about the selected organization only', async () => {
  const site = statusSite({ context: contextOf(ann, [adminGrant], adminGrant.permissions) });

  const answer = await statusOf(site, '/workspace/status?organization_id=org-b');

  assert.deepEqual(answer.body, { state: 'requested', ready: false, message: settingUp });
  assert.deepEqual(site.registry.requests, ['org-a']);
});

for (const [label, context] of [
  ['a member without product access', contextOf(ann, [{ role: 'member', permissions: [] }], [])],
  ['an access decision for another organization', { ...userContext, organizationId: 'org-b' }],
  ['an access decision for another selected organization', { ...userContext, user: { ...ann, selectedOrganizationId: 'org-b' } }],
  ['an access decision for another subject', { ...userContext, user: { ...ann, subject: 'user-other' } }],
  ['an access decision for another authority', { ...userContext, user: { ...ann, authority: 'other-authority' } }],
  ['an access decision without an organization', { user: ann, tenantId: 'tenant-org-a', grants: [userGrant], permissions: userGrant.permissions }],
] as const) {
  test(`Given ${label}, when it reads the workspace status, then it gets the access denial of the portal and no registry work`, async () => {
    const site = statusSite({ context });

    const answer = await statusOf(site);

    assert.equal(answer.status, 403);
    assert.deepEqual(answer.body, { access: 'denied' });
    assert.equal(site.registry.reads, 0);
    assert.deepEqual(site.registry.requests, []);
  });
}

test('Given no current access in the selected organization, or no session, when the workspace status is read, then the account routes refuse it before registry work', async () => {
  const denied = statusSite({ setup: { decisions: new Map([[ann.subject, { allowed: false, reason: 'membership-inactive' }]]) } });
  const refusal = await statusOf(denied);
  assert.equal(refusal.status, 403);
  assert.match(String(refusal.body), /Access denied/);
  const signedOut = statusSite();
  const answer = await signedOut.routes.handle(accountRequest('/workspace/status'));
  assert.equal(answer.status, 401);
  for (const site of [denied, signedOut]) {
    assert.equal(site.registry.reads, 0);
    assert.deepEqual(site.registry.requests, []);
  }
});

test('Given a User, when HEAD or POST reads the workspace status, then HEAD has no body and POST is refused without registry work', async () => {
  const site = statusSite();
  const head = await site.routes.handle(accountRequest('/workspace/status', 'session=ann', { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const post = await site.routes.handle(accountRequest('/workspace/status', 'session=ann', { method: 'POST' }));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
  assert.deepEqual(site.registry.requests, ['org-a']);
});

test('Given a public base path, when the portal reads its workspace status, then the route answers under that path only', async () => {
  const site = statusSite({ setup: { publicBaseUrl: 'https://thermus.example/team' } });
  assert.deepEqual((await statusOf(site, '/team/workspace/status')).body, { state: 'requested', ready: false, message: settingUp });
  await statusOf(site, '/workspace/status');
  assert.deepEqual(site.operations.calls.map(({ request }) => new URL(request.url).pathname), ['/workspace/status'], 'Another path goes to the account operation.');
  assert.deepEqual(site.registry.requests, ['org-a']);
});

test('Given a pending registry read, when the browser aborts the status read, then no answer and no failure report come', async () => {
  const site = statusSite();
  const gate = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const reads = site.registry.readRoutes.bind(site.registry);
  site.registry.readRoutes = async () => { started.resolve(); await gate.promise; return reads(); };
  const abort = new AbortController();
  const answer = site.routes.handle(accountRequest('/workspace/status', 'session=ann', { signal: abort.signal }));
  await started.promise;
  const reason = new DOMException('Browser left the portal', 'AbortError');
  abort.abort(reason);
  await assert.rejects(answer, (error) => error === reason);
  gate.resolve();
  assert.deepEqual(site.failures, []);
});
