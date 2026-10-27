import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import type { AccessDecision } from '../../../src/accounts/identity/access-context.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { accountRequest, adminGrant, allowedFor, ann, contextOf, organization, serve, signedIn, userGrant } from './fixtures/account-routes-fixtures.ts';
import { serveAnn, sessionCookies } from './fixtures/organization-routes-fixtures.ts';

const adminContext = contextOf(ann, [adminGrant], adminGrant.permissions);
const decisions: ReadonlyArray<readonly [string, AccessDecision, boolean]> = [
  ['current Admin', allowedFor(adminContext), true],
  ['current User', allowedFor(contextOf(ann, [userGrant], userGrant.permissions)), false],
  ['a differently cased role', allowedFor({ ...adminContext, grants: [{ ...adminGrant, role: 'Admin' }] }), false],
  ['a role name containing admin', allowedFor({ ...adminContext, grants: [{ ...adminGrant, role: 'superadmin' }] }), false],
  ['empty current permissions', allowedFor({ ...adminContext, permissions: [] }), false],
  ['current permissions without product access', allowedFor({ ...adminContext, permissions: ['billing:manage'] }), false],
  ['an Admin grant without permissions', allowedFor({ ...adminContext, grants: [{ ...adminGrant, permissions: [] }] }), false],
  ['another workspace context', allowedFor({ ...adminContext, organizationId: 'org-b' }), false],
  ['no workspace in context', allowedFor({ ...adminContext, organizationId: undefined }), false],
  ['another subject', allowedFor({ ...adminContext, user: { ...ann, subject: 'other-user' } }), false],
  ['another authority', allowedFor({ ...adminContext, user: { ...ann, authority: 'other-provider' } }), false],
  ['another selected workspace in the context user', allowedFor({ ...adminContext, user: { ...ann, selectedOrganizationId: 'org-b' } }), false],
  ['an empty tenant', allowedFor({ ...adminContext, tenantId: '' }), false],
  ['revoked access', { allowed: false, reason: 'membership-inactive' }, false],
];

for (const [label, decision, admin] of decisions) {
  test(`Given ${label}, when the workspace picker reads current access for its menu, then the picker remains usable and Admin links match only the current workspace`, async () => {
    const { routes, resolver, operations } = serveAnn({}, { decisions: new Map([[ann.subject, decision]]) });
    const response = await routes.handle(accountRequest('/organizations', 'session=ann'));
    assert.equal(response.status, 200);
    assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
    const body = await response.text();
    assert.deepEqual(formsIn(body).map(form => form.label), ['Acme (selected)', 'Globex']);
    const navigation = parseHTML(body).document.querySelector('header nav[aria-label="Workspace"]');
    assert.ok(navigation);
    assert.deepEqual([...navigation.querySelectorAll('a')].map(link => link.textContent), admin
      ? ['Connect', 'Switch Workspace', 'Members', 'Audit Log'] : ['Connect', 'Switch Workspace']);
    assert.equal(navigation.querySelector('[aria-current="page"]')?.textContent, 'Switch Workspace');
    assert.deepEqual(resolver.calls, [ann]);
    assert.deepEqual(operations.calls, []);
  });
}

for (const selectedOrganizationId of [undefined, 'org-removed']) {
  test(`Given ${selectedOrganizationId ?? 'no workspace'} is selected outside the authorized list, when the picker opens, then other memberships cannot provide Admin links and no presentation lookup starts`, async () => {
    const user = { ...ann, selectedOrganizationId };
    const { routes, resolver } = serve({ sessions: new Map([['session=ann', signedIn(user)]]), organizations: new Map([[ann.subject, [organization('org-b', 'Globex')]]]), decisions: new Map([[ann.subject, allowedFor(adminContext)]]) });
    const response = await routes.handle(accountRequest('/organizations', 'session=ann'));
    assert.equal(response.status, 200);
    const body = await response.text();
    const navigation = parseHTML(body).document.querySelector('header nav[aria-label="Workspace"]');
    assert.ok(navigation);
    assert.deepEqual([...navigation.querySelectorAll('a')].map(link => link.textContent), ['Connect', 'Switch Workspace']);
    assert.deepEqual(formsIn(body).map(form => form.label), ['Globex']);
    assert.deepEqual(resolver.calls, []);
  });
}

test('Given an access lookup outage for the picker menu, when authorized workspaces can still be listed, then the picker keeps its forms and basic menu and reports only a fixed safe failure', async () => {
  const outage = new Error('secret-provider-token');
  const { routes, failures } = serveAnn({}, { decisions: new Map([[ann.subject, outage]]) });
  const response = await routes.handle(accountRequest('/organizations', 'session=ann'));
  assert.equal(response.status, 200);
  assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
  const body = await response.text();
  const navigation = parseHTML(body).document.querySelector('header nav[aria-label="Workspace"]');
  assert.ok(navigation);
  assert.deepEqual([...navigation.querySelectorAll('a')].map(link => link.textContent), ['Connect', 'Switch Workspace']);
  assert.equal(formsIn(body).length, 2);
  assert.doesNotMatch(body, /secret-provider-token/);
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.path, '/organizations');
  assert.ok(failures[0]?.cause instanceof Error);
  assert.equal(failures[0].cause.message, 'Workspace navigation access lookup failed.');
  assert.equal(failures[0].cause.cause, outage);
});

test('Given a picker menu access lookup that is still pending, when the request is aborted, then cancellation reaches the caller without a page or failure report', async () => {
  const lookup = Promise.withResolvers<AccessDecision>();
  const started = Promise.withResolvers<void>();
  const { routes, failures } = serveAnn({}, { decisions: new Map([[ann.subject, async () => { started.resolve(); return lookup.promise; }]]) });
  const abort = new AbortController();
  const answer = routes.handle(accountRequest('/organizations', 'session=ann', { signal: abort.signal }));
  const reason = new DOMException('The browser left the picker', 'AbortError');
  await started.promise;
  abort.abort(reason);
  await assert.rejects(answer, error => error === reason);
  lookup.resolve({ allowed: false, reason: 'membership-inactive' });
  assert.deepEqual(failures, []);
});
