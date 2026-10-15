import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Page } from 'playwright';
import { formsIn, type PageForm } from '../../../support/drivers/browser/hosted-browser.ts';
import { once, type LiveRun } from '../../../support/hosted-live/live-run.ts';
import { rolesOf, superAdminRole } from '../../../support/hosted-live/operator-runbook.ts';
import { formNamed, serverGet, serverPost, sessionJson, signInThroughPortal, type PortalVisit, type ServerAnswer } from '../../../support/hosted-live/portal-visit.ts';
import { localOrigin } from '../../../support/hosted-live/settings.ts';
import type { LiveUser } from '../../../support/hosted-live/staging-fixtures.ts';

const signInOptions = { timeout: 240_000 };
const expiryOptions = { timeout: 600_000 };
const sessionCookie = '__Host-thermus-session';
// A browser access token lives for 300 seconds; a little more lets it expire.
const tokenLifetimeWait = 305_000;

interface SelectionVisit extends PortalVisit {
  readonly csrfToken: string;
  readonly offered: readonly PageForm[];
  readonly switched: ServerAnswer;
  // The switch refreshed the session, so its access token expires a lifetime after this time.
  readonly switchedAt: number;
}

function sessionCookiesIn(answer: ServerAnswer): string[] {
  return answer.setCookies.filter((cookie) => cookie.startsWith(`${sessionCookie}=`) && !/Max-Age=0/i.test(cookie));
}

async function organizationForms(page: Page, returnTo = '/organizations'): Promise<PageForm[]> {
  const answer = await serverGet(page, `organizations?return_to=${returnTo}`);
  assert.equal(answer.status, 200, answer.body);
  return formsIn(answer.body);
}

function assertOnboarding(answer: ServerAnswer, who: string): void {
  assert.equal(answer.status, 200, `${who}: ${answer.body}`);
  assert.match(answer.body, /Your account has no active access to an organization\./, who);
  assert.match(answer.body, /contact the operator of this Thermus service/, who);
  assert.doesNotMatch(answer.body, /<form/, who);
}

function labelOf(user: LiveUser): string {
  return user.email.split('@')[0] ?? 'user';
}

// Registers the AUTH-07W cases of the hosted server. It returns the case that needs an expired access token of the
// selection session: the caller registers it after the AUTH-06 cases, whose 300-second wait lets the token expire.
export function describeOrganizationServerCases(run: LiveRun): () => void {
  const requiredMfa = run.settings.mfaPolicy === 'required';
  // The member signs in to A one time and selects B. The later cases use the same session.
  const selection = once(async (): Promise<SelectionVisit> => {
    const { organizationA, organizationB } = await run.fixtures();
    const { users } = await run.organizationFixtures();
    const visit = await signInThroughPortal(run, users.selector, organizationA.name);
    const csrfToken = String((await sessionJson(visit.page)).csrfToken);
    const offered = await organizationForms(visit.page, '/portal/access');
    const switched = await serverPost(visit.page, 'organizations/select', { fields: formNamed(offered, organizationB.name).fields });
    return { ...visit, csrfToken, offered, switched, switchedAt: Date.now() };
  });

  describe('Hosted live gate (AUTH-07W): organization onboarding and selection at https://localhost:46443/ with WorkOS', () => {
    test('Given users without an authorized active organization in WorkOS — only an inactive membership, or only the default role —, when each signs in and opens the organization page, then each gets the invitation and operator guidance without a form, and the billing page and the protected portal request refuse each of them', signInOptions, async () => {
      const { defaultRoleUser } = await run.fixtures();
      const { users } = await run.organizationFixtures();
      for (const user of [users['inactive-only'], defaultRoleUser]) {
        const { page } = await signInThroughPortal(run, user);
        assertOnboarding(await serverGet(page, 'organizations'), labelOf(user));
        assert.equal((await serverGet(page, 'billing')).status, 403, labelOf(user));
        assert.equal((await serverGet(page, 'portal/access')).status, 403, labelOf(user));
        await page.context().close();
      }
    });

    test('Given a member with User and Admin in A, User in B, and an inactive membership in the operator organization, when it opens the organization page and selects B for the portal, then only A and B are offered with their WorkOS names, the 303 sets a new session cookie, and the session and the portal are in B', signInOptions, async (t) => {
      const { organizationA, organizationB } = await run.fixtures();
      const { page, offered, switched } = await selection();
      const portal = await serverGet(page, 'portal/access');
      const relisted = (await organizationForms(page)).map(({ label }) => label);
      t.diagnostic(`offered: ${JSON.stringify(offered.map(({ label }) => label))}; switch: ${switched.status} to ${String(switched.location)}`);

      // WorkOS gives the memberships of a user from the newest, and the fixtures are made at the same time.
      assert.deepEqual(offered.map(({ label }) => label).toSorted(), [`${organizationA.name} (selected)`, organizationB.name].toSorted());
      assert.equal(switched.status, 303, switched.body);
      assert.equal(switched.location, `${localOrigin}/portal/access`);
      assert.equal(sessionCookiesIn(switched).length, 1, 'The switch set no new session cookie.');
      assert.equal(portal.status, 200, portal.body);
      assert.deepEqual(JSON.parse(portal.body), { organizationId: organizationB.id, roles: ['user'] });
      const selectedSession = await sessionJson(page);
      assert.equal(selectedSession.organizationId, organizationB.id);
      assert.equal(selectedSession.mfaCompleted, requiredMfa);
      assert.deepEqual(relisted.toSorted(), [organizationA.name, `${organizationB.name} (selected)`].toSorted());
    });

    test('Given the same member in B, when it posts a selection of an organization without its membership, of its inactive membership, from another origin, or with another form token, then each gets 403 and no switch: the session stays in B', signInOptions, async () => {
      const { clientOwner, organizationA, organizationB } = await run.fixtures();
      const { operatorOrganization } = await run.organizationFixtures();
      const { page } = await selection();
      const fields = formNamed(await organizationForms(page), organizationA.name).fields;

      const refusals = [
        await serverPost(page, 'organizations/select', { fields: { ...fields, organization_id: clientOwner.id } }),
        await serverPost(page, 'organizations/select', { fields: { ...fields, organization_id: operatorOrganization.id } }),
        await serverPost(page, 'organizations/select', { fields, origin: 'https://evil.example' }),
        await serverPost(page, 'organizations/select', { fields: { ...fields, csrf_token: 'forged-token' } }),
      ];

      assert.deepEqual(refusals.map(({ status }) => status), [403, 403, 403, 403]);
      assert.ok(refusals.every((refusal) => refusal.location === undefined && sessionCookiesIn(refusal).length === 0), 'A refused selection switched or changed the session.');
      const selectedSession = await sessionJson(page);
      assert.equal(selectedSession.organizationId, organizationB.id);
      assert.equal(selectedSession.mfaCompleted, requiredMfa);
    });

    test(`Given an operator Super Admin in the ${requiredMfa ? 'Required' : 'Optional'} MFA profile, when it signs in, then its organization is offered, billing ${requiredMfa ? 'opens with MFA evidence' : 'is refused without MFA evidence'}, product access and a customer Super Admin grant are refused; after operator revocation the same session loses its organization access`, signInOptions, async (t) => {
      const { runbook, operatorOrganization, users } = await run.organizationFixtures();
      const user = users['hosted-super-admin'];
      const request = { organizationId: operatorOrganization.id, email: user.email };
      assert.equal((await runbook.grantSuperAdmin(request)).outcome, 'applied');
      const { page } = await signInThroughPortal(run, user);
      const session = await sessionJson(page);
      const membership = await runbook.membership(user.id, operatorOrganization.id);
      assert.ok(membership, 'The Super Admin has no membership.');

      const offered = (await organizationForms(page)).map(({ label }) => label);
      const billing = await serverGet(page, 'billing');
      const portal = await serverGet(page, 'portal/access');
      const customerGrant = await serverPost(page, 'members/grants', { fields: {
        csrf_token: String(session.csrfToken), organization_id: operatorOrganization.id, membership_id: membership.id, revision: 'live', role: superAdminRole, action: 'grant',
      } });
      const membershipAfterCustomerGrant = await runbook.membership(user.id, operatorOrganization.id);
      const rolesAfterCustomerGrant = rolesOf(membershipAfterCustomerGrant);
      await runbook.revokeSuperAdmin(request);
      const billingAfterRevocation = await serverGet(page, 'billing');
      const organizationsAfterRevocation = await serverGet(page, 'organizations');
      const records = (await run.site()).log.lines.filter((line) => line.startsWith('INFO Account change record:'));
      t.diagnostic(`billing ${billing.status}, portal ${portal.status}, customer Super Admin grant ${customerGrant.status}, billing after the revocation ${billingAfterRevocation.status}`);

      assert.equal(session.organizationId, operatorOrganization.id);
      assert.equal(session.mfaCompleted, requiredMfa);
      assert.deepEqual(offered, [`${operatorOrganization.name} (selected)`]);
      assert.equal(billing.status, requiredMfa ? 200 : 403, billing.body);
      assert.match(billing.body, requiredMfa ? /Plan: Free/ : /Administration needs a sign-in that completed multi-factor authentication/);
      assert.equal(portal.status, 403);
      assert.equal(customerGrant.status, 403, customerGrant.body);
      assert.match(customerGrant.body, requiredMfa ? /Your account cannot make this change in the selected organization\. Nothing changed\./ : /Administration needs a sign-in that completed multi-factor authentication/);
      assert.deepEqual(membershipAfterCustomerGrant, membership, 'The refused customer grant changed the WorkOS membership.');
      assert.deepEqual(rolesAfterCustomerGrant, [superAdminRole]);
      assert.ok(records.some((line) => line.includes(`"role":"${superAdminRole}"`) && line.includes(`"outcome":"${requiredMfa ? 'denied' : 'mfa-required'}"`)), 'The refused customer grant has no change record.');
      assert.equal(billingAfterRevocation.status, 403);
      assertOnboarding(organizationsAfterRevocation, labelOf(user));
      await page.context().close();
    });
  });

  return () => describeExpiredSelectionCase(run, selection);
}

function describeExpiredSelectionCase(run: LiveRun, selection: () => Promise<SelectionVisit>): void {
  describe('Hosted live gate (AUTH-07W): a selection after the access token of the session expired', () => {
    test('Given the selection session in B after its access token expired, when it posts a refused selection, then the 403 carries the refreshed session cookie, the form token stays the same, and the session stays in B', expiryOptions, async (t) => {
      const { clientOwner, organizationB } = await run.fixtures();
      const visit = await selection();
      await sleep(Math.max(0, visit.switchedAt + tokenLifetimeWait - Date.now()));
      // The fields come from the visit, because a page request now would refresh the session before the post.
      const fields = { csrf_token: visit.csrfToken, organization_id: clientOwner.id, return_to: '/organizations' };

      const refused = await serverPost(visit.page, 'organizations/select', { fields });
      const session = await sessionJson(visit.page);
      t.diagnostic(`refused selection after the expiry: ${refused.status} with ${sessionCookiesIn(refused).length} session cookie(s)`);

      assert.equal(refused.status, 403, refused.body);
      assert.equal(sessionCookiesIn(refused).length, 1, 'The refusal did not carry the refreshed session cookie.');
      assert.equal(session.csrfToken, visit.csrfToken);
      assert.equal(session.mfaCompleted, run.settings.mfaPolicy === 'required');
      assert.equal(session.organizationId, organizationB.id);
      await visit.page.context().close();
    });
  });
}
