import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import type { Page } from 'playwright';
import { WorkOSOrganizations, workosMembershipReads } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { formLabelled, formsIn, type PageForm } from '../../support/drivers/browser/hosted-browser.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';
import { completeAuthKit } from '../../support/hosted-live/authkit-driver.ts';
import { authorizeWithConnect } from '../../support/hosted-live/connect-grant.ts';
import { LiveRun } from '../../support/hosted-live/live-run.ts';
import { LocalHttpsSite } from '../../support/hosted-live/local-https-site.ts';
import { rolesOf } from '../../support/hosted-live/operator-runbook.ts';
import { assertProviderPasswordProfile } from '../../support/hosted-live/password-profile.ts';
import { serverGet, serverPost, sessionJson, signInThroughPortal, type ServerAnswer } from '../../support/hosted-live/portal-visit.ts';
import { RemovalFixtures } from '../../support/hosted-live/removal-fixtures.ts';
import { statusOf } from '../../support/hosted-live/sdk-errors.ts';
import { localOrigin, type HostedLiveSettings } from '../../support/hosted-live/settings.ts';
import { field, queryWidgetGraph } from '../../support/hosted-live/workos-api.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

function stagingSettings(): HostedLiveSettings {
  const { WORKOS_API_KEY: apiKey = '', WORKOS_CLIENT_ID: clientId = '', WORKOS_AUTHKIT_ISSUER: authkitIssuer = '' } = process.env;
  assert.ok(apiKey.startsWith('sk_test_'), 'The scoped removal proof requires a WorkOS staging key.');
  assert.ok(clientId !== '', 'The scoped removal proof requires WORKOS_CLIENT_ID.');
  const issuer = URL.parse(authkitIssuer);
  assert.ok(issuer?.protocol === 'https:' && issuer.username === '' && issuer.password === '' && !/[\s\p{Cc}?#]/u.test(authkitIssuer), 'The scoped removal proof requires an HTTPS AuthKit issuer without credentials, query, or fragment.');
  return { apiKey, clientId, authkitIssuer };
}

async function memberForm(page: Page, membershipId: string): Promise<PageForm> {
  const answer = await serverGet(page, 'members');
  assert.equal(answer.status, 200, 'The current Admin must open Members.');
  const form = formsIn(answer.body).find(({ fields }) => fields.membership_id === membershipId);
  assert.ok(form, `Members has no removal control for the exact membership ${membershipId}.`);
  return form;
}

async function removeThroughMembers(page: Page, membershipId: string, confirmation: RegExp): Promise<{ readonly workspace: string; readonly signIn: string }> {
  await page.goto(`${localOrigin}/members`);
  const details = page.locator('details').filter({ has: page.locator(`input[name="membership_id"][value="${membershipId}"]`) });
  assert.equal(await details.count(), 1);
  await details.locator('summary').click();
  await Promise.all([page.waitForNavigation(), details.getByRole('button', { name: confirmation }).click()]);
  await page.getByRole('heading', { name: 'Member removed', exact: true }).waitFor();
  assert.equal(await page.locator('form').count(), 0, 'The confirmed result must not repeat the removal form.');
  const workspace = await page.getByRole('link', { name: 'Choose a workspace or check access', exact: true }).getAttribute('href');
  const signIn = await page.getByRole('link', { name: 'sign in again', exact: true }).getAttribute('href');
  assert.ok(workspace && signIn, 'The removal result must provide workspace and sign-in guidance.');
  return { workspace, signIn };
}

async function seatsOn(page: Page, expected: number): Promise<void> {
  const answer = await serverGet(page, 'members');
  assert.equal(answer.status, 200);
  assert.equal(Number(/Active product members: (\d+)/.exec(answer.body)?.[1]), expected);
}

function assertRemovedAccess(answer: ServerAnswer): void {
  assert.ok([303, 401, 403].includes(answer.status), `A removed membership still has portal access: HTTP ${answer.status}.`);
  if (answer.status === 303) assert.ok(answer.location?.startsWith(`${localOrigin}/login`), 'The expired or revoked session must lead to sign-in.');
}

test('Given fresh password-only WorkOS fixtures and disposable Slice 2 SQL with two Admins and a User, when Members refuses unsafe requests, removes the User and the acting Admin, then exact memberships disappear, portal and MCP access stop, other access and both accounts remain, selection works, the last Admin is protected, and a fresh invitation restores only its new role', { timeout: 600_000 }, async (t) => {
  const settings = stagingSettings();
  const sql = await postgresSettingsSite(t);
  const directory = await mkdtemp(join(tmpdir(), 'thermus-removal-live-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const caPath = join(directory, 'ca.pem');
  await writeFile(caPath, sql.connection.ca);
  const run = new LiveRun(settings, { site: () => LocalHttpsSite.start(settings, { storageEnvironment: {
    DATABASE_URL: sql.connection.connectionString, DATABASE_CA_CERT_PATH: caPath,
    LOGGING_DESTINATION_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  } }) });
  const fixtures = new RemovalFixtures(run, resolve('.cache/s25-02/live'));
  t.after(() => fixtures.end());
  // The site takes the fixed port of the registered URIs before the first WorkOS call. Another run that holds the port
  // stops this proof before it makes any staging data.
  await run.site();
  const candidate = (await promisify(execFile)('git', ['rev-parse', 'HEAD'])).stdout.trim();
  const workingTreeClean = (await promisify(execFile)('git', ['status', '--porcelain'])).stdout.trim() === '';
  await fixtures.note('proof-started', { candidate, workingTreeClean, clientId: settings.clientId, proof: 'hosted-removal.live', profile: 'existing password-only staging', factorEvidence: 'No live factor observation. No factor was already available on these fresh identities. No MFA API was called; controlled sentinel coverage is separate.' });

  const organization = await fixtures.organization('remove');
  const other = await fixtures.organization('other');
  const owner = await fixtures.organization('client-owner');
  const admin = await fixtures.user('removing-admin');
  const remaining = await fixtures.user('remaining-admin');
  const user = await fixtures.user('removed-user');
  const adminMembership = await fixtures.membership(admin, organization, 'admin');
  const remainingMembership = await fixtures.membership(remaining, organization, 'admin');
  const userMembership = await fixtures.membership(user, organization, 'user');
  const adminOtherMembership = await fixtures.membership(admin, other, 'user');
  const userOtherMembership = await fixtures.membership(user, other, 'user');
  const clientId = await fixtures.oauthClient(owner);
  const { token: widgetToken } = await run.workos.widgets.createToken({ organizationId: organization.id, userId: admin.id, scopes: ['widgets:users-table:manage'] });
  assertProviderPasswordProfile(field(await queryWidgetGraph(widgetToken, 'query { authenticationSettings { mfaEnabled mfaRequired passwordAuthEnabled } }'), 'authenticationSettings'));
  await fixtures.note('password-profile-confirmed', { passwordAuthEnabled: true, mfaEnabled: false, mfaRequired: false });

  const adapter = new WorkOSOrganizations({ authority: workosAuthority(settings.clientId), memberships: workosMembershipReads(run.workos), userManagement: run.workos.userManagement, authorization: run.workos.authorization });
  for (const membershipId of [adminMembership, remainingMembership, userMembership, adminOtherMembership, userOtherMembership]) {
    const { data } = await run.workos.get<{ readonly directory_managed?: unknown }>(`/user_management/organization_memberships/${membershipId}`);
    assert.equal(data.directory_managed, false, 'Only explicit ordinary management evidence permits live removal.');
    assert.equal((await adapter.member(membershipId))?.management, 'ordinary');
    await fixtures.note('management-observed', { membershipId, directoryManaged: data.directory_managed, adapterManagement: 'ordinary' });
  }
  await fixtures.note('management-limit', { reason: 'External and unknown management refusal are controlled-only proofs. This run creates no directory or SSO resource and changes no such setting.' });

  const adminVisit = await signInThroughPortal(run, admin, organization.name);
  const userVisit = await signInThroughPortal(run, user, organization.name);
  const remainingVisit = await signInThroughPortal(run, remaining, organization.name);
  const grants = [];
  for (const identity of [admin, user]) {
    const grant = await authorizeWithConnect(run, { user: identity, organizationName: organization.name, clientId });
    assert.equal(grant.stateMatches, true);
    assert.equal(grant.visit.pages.some(path => path.startsWith('/mfa/')), false);
    grants.push(grant);
  }
  const [adminGrant, userGrant] = grants;
  assert.ok(adminGrant, 'The removing Admin must have a Connect grant.');
  assert.ok(userGrant, 'The removable User must have a Connect grant.');
  const mcpStatus = async (accessToken: string): Promise<number> => {
    const site = await run.site();
    const response = await fetch(mcpRequest({ url: new URL('mcp', site.thermusUrl).href, method: 'server/discover', token: accessToken }));
    await response.body?.cancel();
    return response.status;
  };
  for (const visit of [adminVisit, userVisit, remainingVisit]) {
    assert.ok(visit.pages.some(path => path.startsWith('/password')));
    assert.equal((await sessionJson(visit.page)).mfaCompleted, false);
    assert.equal((await serverGet(visit.page, 'portal/access')).status, 200);
  }
  for (const grant of grants) assert.equal(await mcpStatus(grant.tokens.accessToken), 200);
  await seatsOn(adminVisit.page, 3);

  const form = await memberForm(adminVisit.page, userMembership);
  const before = await run.workos.userManagement.getOrganizationMembership(userMembership);
  const foreign = await adapter.member(userOtherMembership);
  assert.ok(foreign);
  const refusals = [
    await serverPost(adminVisit.page, 'members/remove', { fields: { ...form.fields, revision: 'stale-revision' } }),
    await serverPost(adminVisit.page, 'members/remove', { fields: { ...form.fields, membership_id: userOtherMembership, revision: foreign.revision } }),
    await serverPost(userVisit.page, 'members/remove', { fields: { ...form.fields, csrf_token: String((await sessionJson(userVisit.page)).csrfToken) } }),
    await serverPost(adminVisit.page, 'members/remove', { fields: { ...form.fields, csrf_token: 'forged-token' } }),
  ];
  assert.deepEqual(refusals.map(answer => answer.status), [409, 403, 403, 403]);
  assert.deepEqual(await run.workos.userManagement.getOrganizationMembership(userMembership), before);
  assert.equal((await run.workos.userManagement.getOrganizationMembership(userOtherMembership)).status, 'active');
  await fixtures.note('safe-refusals-confirmed', { cases: ['stale revision', 'foreign membership', 'User actor', 'forged form token'], statuses: refusals.map(answer => answer.status), retainedMemberships: [userMembership, userOtherMembership] });

  await removeThroughMembers(adminVisit.page, userMembership, /^Remove /);
  assert.equal(await run.workos.userManagement.getOrganizationMembership(userMembership).then(() => 200, statusOf), 404);
  const userPortal = await serverGet(userVisit.page, 'portal/access');
  assertRemovedAccess(userPortal);
  assert.equal(await mcpStatus(userGrant.tokens.accessToken), 403);
  await seatsOn(adminVisit.page, 2);
  await fixtures.note('user-removal-confirmed', { membershipId: userMembership, providerRead: 404, portalStatus: userPortal.status, mcpStatus: 403, seats: 2 });

  const selfRemoval = await removeThroughMembers(adminVisit.page, adminMembership, /^Leave /);
  assert.equal(await run.workos.userManagement.getOrganizationMembership(adminMembership).then(() => 200, statusOf), 404);
  const adminPortal = await serverGet(adminVisit.page, 'portal/access');
  assertRemovedAccess(adminPortal);
  assert.equal(await mcpStatus(adminGrant.tokens.accessToken), 403);
  await seatsOn(remainingVisit.page, 1);
  const last = await memberForm(remainingVisit.page, remainingMembership);
  const lastRefusal = await serverPost(remainingVisit.page, 'members/remove', { fields: last.fields });
  assert.equal(lastRefusal.status, 409);
  assert.match(lastRefusal.body, /Keep an Admin/);
  assert.equal((await run.workos.userManagement.getOrganizationMembership(remainingMembership)).status, 'active');
  const workspaceUrl = new URL(selfRemoval.workspace, localOrigin);
  assert.equal(workspaceUrl.origin, localOrigin);
  const afterSelfRemoval = await serverGet(adminVisit.page, selfRemoval.workspace);
  assert.ok([200, 303, 401].includes(afterSelfRemoval.status), 'Self-removal must permit workspace selection or reauthentication.');
  if (afterSelfRemoval.status === 200) {
    await adminVisit.page.goto(workspaceUrl.href);
  } else {
    if (afterSelfRemoval.status === 303) assert.ok(afterSelfRemoval.location?.startsWith(`${localOrigin}/login`));
    const signInUrl = new URL(selfRemoval.signIn, localOrigin);
    assert.equal(signInUrl.origin, localOrigin);
    assert.equal(signInUrl.searchParams.get('return_to'), workspaceUrl.pathname, 'The emitted sign-in link must return to workspace selection.');
    await adminVisit.page.goto(signInUrl.href);
    const pages = await completeAuthKit(adminVisit.page, { user: admin, authkitHost: new URL(settings.authkitIssuer).host, organizationName: other.name });
    assert.equal(pages.some(path => path.startsWith('/mfa/')), false);
  }
  await adminVisit.page.waitForURL(workspaceUrl.href);
  await adminVisit.page.getByRole('heading', { name: 'Select an organization', exact: true }).waitFor();
  const afterGuidance = formsIn(await adminVisit.page.content());
  assert.deepEqual(afterGuidance.map(choice => choice.fields.organization_id), [other.id]);
  const [otherSelection] = afterGuidance;
  assert.ok(otherSelection, 'The emitted guidance must offer the retained workspace.');
  const selectedOther = await serverPost(adminVisit.page, 'organizations/select', { fields: otherSelection.fields });
  assert.equal(selectedOther.status, 303);
  const usableOther = await serverGet(adminVisit.page, 'portal/access');
  assert.equal(usableOther.status, 200);
  assert.equal((JSON.parse(usableOther.body) as { organizationId: string }).organizationId, other.id);
  await fixtures.note('self-removal-confirmed', { membershipId: adminMembership, providerRead: 404, portalStatus: adminPortal.status, mcpStatus: 403, seats: 1, lastAdminRefusal: lastRefusal.status, existingSessionSelectionStatus: afterSelfRemoval.status, emittedGuidanceFollowed: true, reauthenticationRequired: afterSelfRemoval.status !== 200, usableSelection: true });

  for (const [identity, membershipId] of [[admin, adminOtherMembership], [user, userOtherMembership]] as const) {
    const account = await run.workos.userManagement.getUser(identity.id);
    assert.deepEqual([account.id, account.email], [identity.id, identity.email]);
    const retained = await run.workos.userManagement.getOrganizationMembership(membershipId);
    assert.deepEqual([retained.userId, retained.organizationId, retained.status, rolesOf(retained)], [identity.id, other.id, 'active', ['user']]);
    const fresh = await signInThroughPortal(run, identity, other.name);
    const choices = await serverGet(fresh.page, 'organizations');
    assert.equal(choices.status, 200);
    const selection = formLabelled(formsIn(choices.body), `${other.name} (selected)`);
    assert.equal(formsIn(choices.body).some(choice => choice.fields.organization_id === organization.id), false);
    const selected = await serverPost(fresh.page, 'organizations/select', { fields: selection.fields });
    assert.equal(selected.status, 303);
    assert.equal((await serverGet(fresh.page, 'portal/access')).status, 200);
    const otherGrant = await authorizeWithConnect(run, { user: identity, organizationName: other.name, clientId });
    assert.equal(otherGrant.stateMatches, true);
    assert.equal(await mcpStatus(otherGrant.tokens.accessToken), 200);
    await fixtures.note('account-and-other-access-preserved', { userId: identity.id, membershipId, organizationId: other.id, portalStatus: 200, mcpStatus: 200, passwordReauthentication: true, usableSelection: true });
    await fresh.page.context().close();
  }

  const send = formsIn((await serverGet(remainingVisit.page, 'members')).body).find(candidateForm => candidateForm.action.endsWith('/invitations/send'));
  assert.ok(send);
  const invited = await serverPost(remainingVisit.page, 'invitations/send', { fields: { ...send.fields, email: user.email, role: 'admin' } });
  assert.equal(invited.status, 303);
  const invitations = await run.workos.userManagement.listInvitations({ organizationId: organization.id, email: user.email });
  assert.equal(invitations.data.length, 1);
  const [invitation] = invitations.data;
  assert.ok(invitation, 'The fresh invitation must be present in WorkOS.');
  assert.equal(invitation.state, 'pending');
  assert.equal(invitation.roleSlug, 'admin');
  // This privileged API acceptance proves the new provider membership and roles. It does not prove recipient/link rules.
  const accepted = await run.workos.userManagement.acceptInvitation(invitation.id);
  assert.equal(accepted.state, 'accepted');
  const rejoined = await run.workos.userManagement.listOrganizationMemberships({ userId: user.id, organizationId: organization.id, statuses: ['active', 'inactive', 'pending'] });
  assert.equal(rejoined.data.length, 1);
  const [replacement] = rejoined.data;
  assert.ok(replacement, 'The new membership must be present after invitation acceptance.');
  await fixtures.recordReplacementMembership(replacement.id);
  assert.notEqual(replacement.id, userMembership);
  assert.deepEqual([replacement.status, rolesOf(replacement)], ['active', ['admin']]);
  assert.equal(await run.workos.userManagement.getOrganizationMembership(userMembership).then(() => 200, statusOf), 404);
  const rejoinVisit = await signInThroughPortal(run, user, organization.name);
  const rejoinAccess = await serverGet(rejoinVisit.page, 'portal/access');
  assert.equal(rejoinAccess.status, 200);
  assert.deepEqual((JSON.parse(rejoinAccess.body) as { roles: string[] }).roles, ['admin']);
  assert.equal((await serverGet(rejoinVisit.page, 'members')).status, 200);
  const rejoinGrant = await authorizeWithConnect(run, { user, organizationName: organization.name, clientId });
  assert.equal(rejoinGrant.stateMatches, true);
  assert.equal(await mcpStatus(rejoinGrant.tokens.accessToken), 200);
  await seatsOn(remainingVisit.page, 2);
  await fixtures.note('fresh-invitation-rejoin-confirmed', { invitationId: invitation.id, replacementMembershipId: replacement.id, removedMembershipId: userMembership, roles: ['admin'], seats: 2, acceptance: 'privileged WorkOS API; recipient/link semantics are outside this proof', portalStatus: 200, mcpStatus: 200 });
  await fixtures.note('proof-complete', { candidate });
  t.diagnostic(`Scoped WorkOS removal proof ${fixtures.runId}; candidate ${candidate}; evidence .cache/s25-02/live/${fixtures.runId}.jsonl. No live factor observation or MFA API dependency.`);
});
