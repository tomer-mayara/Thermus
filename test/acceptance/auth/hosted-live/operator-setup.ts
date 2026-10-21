import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, test, type TestContext } from 'node:test';
import type { Organization, OrganizationMembership, WorkOS } from '@workos-inc/node';
import { WorkOSOrganizations } from '../../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosAuthority } from '../../../../src/accounts/providers/workos/workos-settings.ts';
import { BillingFree } from '../../../../src/accounts/billing/billing-free.ts';
import { OrganizationAdministration } from '../../../../src/accounts/organizations/organization-administration.ts';
import type { LiveRun } from '../../../support/hosted-live/live-run.ts';
import { OperatorRunbook, rolesOf, superAdminRole, type OperatorRecord } from '../../../support/hosted-live/operator-runbook.ts';
import { operatorActor, type OrganizationFixtures } from '../../../support/hosted-live/organization-fixtures.ts';
import { statusOf } from '../../../support/hosted-live/sdk-errors.ts';
import type { LiveUser } from '../../../support/hosted-live/staging-fixtures.ts';

const proofOptions = { timeout: 120_000 };
const superAdminGrant = { role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] };
const recordFields = ['time', 'actor', 'organizationId', 'target', 'action', 'outcome'];

// A runbook whose first inspection is followed by a change of another person before the runbook writes: a change at
// the same time as the operator step, in the order in which a replacement of the complete role set loses it.
class RunbookWithChangeAfterInspection extends OperatorRunbook {
  #change: (() => Promise<unknown>) | undefined;

  constructor(workos: WorkOS, change: () => Promise<unknown>) {
    super(workos, operatorActor);
    this.#change = change;
  }

  override async membership(userId: string, organizationId: string): Promise<OrganizationMembership | undefined> {
    const membership = await super.membership(userId, organizationId);
    const change = this.#change;
    this.#change = undefined;
    await change?.();
    return membership;
  }
}

// One role of a membership on the authorization resource of the organization, as a customer grant change of AUTH-08W
// writes it. The resource has the external ID of the organization.
function organizationRole(fixtures: OrganizationFixtures, membership: OrganizationMembership, roleSlug: string) {
  return { organizationMembershipId: membership.id, roleSlug, resourceTypeSlug: 'organization', resourceExternalId: fixtures.organizationRequest.externalId };
}

function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

function describeRecord(t: TestContext, record: OperatorRecord): void {
  t.diagnostic(`record: ${record.action} ${record.outcome}; roles ${JSON.stringify(record.rolesBefore ?? null)} > ${JSON.stringify(record.rolesAfter ?? null)}${record.reason === undefined ? '' : `; ${record.reason}`}`);
}

export function describeOperatorSetupProofs(run: LiveRun): void {
  const { workos, settings } = run;
  // The application reads of the hosted edition, against the staging environment.
  const directory = new WorkOSOrganizations({
    authority: workosAuthority(settings.clientId),
    userManagement: workos.userManagement,
    authorization: workos.authorization,
    organizations: workos.organizations,
  });

  async function membershipOf(fixtures: OrganizationFixtures, user: LiveUser, organizationId = fixtures.operatorOrganization.id): Promise<OrganizationMembership | undefined> {
    return fixtures.runbook.membership(user.id, organizationId);
  }

  async function membershipsOfUser(userId: string): Promise<string[]> {
    const { data } = await workos.userManagement.listOrganizationMemberships({ userId, statuses: ['active', 'inactive', 'pending'], limit: 100 });
    return data.map((membership) => `${membership.organizationId} ${membership.status} ${JSON.stringify(rolesOf(membership))}`).toSorted();
  }

  // A create that WorkOS must refuse. If WorkOS makes the organization, the run deletes it at the end.
  async function refusedOrganization(request: { readonly name: string; readonly externalId: string }, idempotencyKey?: string): Promise<unknown> {
    try {
      const organization: Organization = await workos.organizations.createOrganization({ name: request.name, externalId: request.externalId }, idempotencyKey === undefined ? {} : { idempotencyKey });
      run.recordFixture('organization', organization.id);
      return undefined;
    } catch (error) {
      return error;
    }
  }

  describe('Hosted live proofs (AUTH-07W): external operator setup and recovery with the pinned SDK', () => {
    test('Given the external ID of the operator, when the operator locates or creates the organization, then WorkOS has it once: a second create with the same external ID is refused with external_id_already_used, also with an idempotency key, and a second locate step finds it without a change', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const { runbook, organizationRequest, operatorOrganization } = fixtures;

      const refusals = [await refusedOrganization(organizationRequest), await refusedOrganization(organizationRequest, randomUUID())];
      const located = await runbook.organization(organizationRequest);
      for (const refusal of refusals) t.diagnostic(`a second create: ${refusal === undefined ? 'made one' : `refused with HTTP ${String(statusOf(refusal))} ${String(codeOf(refusal))}`}`);

      assert.equal(runbook.records[0]?.outcome, 'applied', 'The first step of the run did not create the organization.');
      for (const refusal of refusals) {
        assert.ok(refusal !== undefined, 'WorkOS made a second organization with the same external ID.');
        assert.deepEqual([statusOf(refusal), codeOf(refusal)], [400, 'external_id_already_used']);
      }
      assert.equal(located.id, operatorOrganization.id);
      assert.equal(located.externalId, organizationRequest.externalId);
      assert.equal(runbook.records.at(-1)?.outcome, 'unchanged');
    });

    test('Given a verified identity without a membership, when the operator grants Super Admin, then WorkOS has exactly the role super-admin for it, the application reads only the Super Admin grant — no Admin, no User —, and a second grant changes nothing', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['new-super-admin'];
      const organizationId = fixtures.operatorOrganization.id;

      const granted = await fixtures.runbook.grantSuperAdmin({ organizationId, email: user.email });
      const grants = await directory.activeGrants(user.id, organizationId);
      const again = await fixtures.runbook.grantSuperAdmin({ organizationId, email: user.email });
      describeRecord(t, granted);
      describeRecord(t, again);

      assert.deepEqual([granted.outcome, granted.rolesBefore, granted.rolesAfter], ['applied', [], [superAdminRole]]);
      assert.deepEqual(grants, [superAdminGrant]);
      assert.deepEqual([again.outcome, again.rolesAfter], ['unchanged', [superAdminRole]]);
      assert.deepEqual(rolesOf(await membershipOf(fixtures, user)), [superAdminRole]);
    });

    test('Given an identity with User and Admin in the organization and User in another organization, when the operator grants and then revokes Super Admin, then User and Admin stay at each step, and the identity and the other membership do not change', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users.independent;
      const organizationId = fixtures.operatorOrganization.id;
      const before = await membershipsOfUser(user.id);

      const granted = await fixtures.runbook.grantSuperAdmin({ organizationId, email: user.email });
      const grantsWithSuperAdmin = await directory.activeGrants(user.id, organizationId);
      const revoked = await fixtures.runbook.revokeSuperAdmin({ organizationId, email: user.email });
      const identity = await workos.userManagement.getUser(user.id);
      const after = await membershipsOfUser(user.id);
      describeRecord(t, granted);
      describeRecord(t, revoked);

      assert.deepEqual([granted.outcome, granted.rolesBefore, granted.rolesAfter], ['applied', ['admin', 'user'], ['admin', superAdminRole, 'user']]);
      assert.deepEqual(grantsWithSuperAdmin?.map(({ role }) => role).toSorted(), ['admin', superAdminRole, 'user']);
      assert.deepEqual([revoked.outcome, revoked.rolesAfter], ['applied', ['admin', 'user']]);
      assert.deepEqual([identity.id, identity.email], [user.id, user.email]);
      assert.deepEqual(after, before);
    });

    test('Given a membership made without a role, when its role assignments are read and the operator grants Super Admin, then the default role member is a role assignment on the authorization resource of type organization with the external ID of the organization, a role assignment that names the organization ID instead is refused with 404 entity_not_found and changes nothing, and the grant adds super-admin and keeps member', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['member-only'];
      const { externalId } = fixtures.organizationRequest;
      const membership = await membershipOf(fixtures, user);
      assert.ok(membership, 'The identity has no membership.');
      const { organizationId } = membership;

      const { data: assignments } = await workos.authorization.listRoleAssignments({ organizationMembershipId: membership.id });
      const byOrganizationId = await workos.authorization.assignRole({ ...organizationRole(fixtures, membership, superAdminRole), resourceExternalId: organizationId }).then(() => undefined, (error: unknown) => error);
      const rolesAfterRefusal = rolesOf(await membershipOf(fixtures, user));
      const granted = await fixtures.runbook.grantSuperAdmin({ organizationId, email: user.email });
      t.diagnostic(`role assignments: ${JSON.stringify(assignments.map(({ role, resource }) => `${role.slug} on ${resource.resourceTypeSlug} ${resource.externalId === externalId ? 'with the external ID' : 'with another external ID'}`))}`);
      t.diagnostic(`a role assignment by the organization ID: ${byOrganizationId === undefined ? 'accepted' : `refused with HTTP ${String(statusOf(byOrganizationId))} ${String(codeOf(byOrganizationId))}`}`);
      describeRecord(t, granted);

      assert.deepEqual(assignments.map(({ role, resource }) => [role.slug, resource.resourceTypeSlug, resource.externalId]), [['member', 'organization', externalId]]);
      assert.deepEqual([statusOf(byOrganizationId), codeOf(byOrganizationId)], [404, 'entity_not_found']);
      assert.deepEqual(rolesAfterRefusal, ['member']);
      assert.deepEqual([granted.outcome, granted.rolesBefore, granted.rolesAfter], ['applied', ['member'], ['member', superAdminRole]]);
    });

    test('Given an active membership with User and Admin, when the operator grants Super Admin and a customer revokes Admin with a single-role write after the inspection of the runbook and before its write, then the grant adds only super-admin, and the Admin revocation of the customer stays', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['concurrent-grant'];
      const membership = await membershipOf(fixtures, user);
      assert.ok(membership, 'The identity has no membership.');
      const runbook = new RunbookWithChangeAfterInspection(workos, () => workos.authorization.removeRole(organizationRole(fixtures, membership, 'admin')));

      const granted = await runbook.grantSuperAdmin({ organizationId: membership.organizationId, email: user.email });
      const roles = rolesOf(await membershipOf(fixtures, user));
      describeRecord(t, granted);

      assert.deepEqual(roles, [superAdminRole, 'user'], 'The operator grant did not keep the Admin revocation of the customer at the same time.');
      assert.deepEqual([granted.outcome, granted.rolesBefore, granted.rolesAfter], ['applied', ['admin', 'user'], [superAdminRole, 'user']]);
    });

    test('Given an active membership with only Super Admin, when the operator revokes Super Admin and a customer grants User with a single-role write after the inspection of the runbook and before its write, then the revocation removes only super-admin, and the User grant of the customer stays', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['concurrent-revoke'];
      const membership = await membershipOf(fixtures, user);
      assert.ok(membership, 'The identity has no membership.');
      const runbook = new RunbookWithChangeAfterInspection(workos, () => workos.authorization.assignRole(organizationRole(fixtures, membership, 'user')));

      const revoked = await runbook.revokeSuperAdmin({ organizationId: membership.organizationId, email: user.email });
      const current = await membershipOf(fixtures, user);
      describeRecord(t, revoked);

      assert.deepEqual(rolesOf(current), ['user'], 'The operator revocation did not keep the User grant of the customer at the same time.');
      assert.equal(current?.status, 'active');
      assert.deepEqual([revoked.outcome, revoked.rolesBefore, revoked.rolesAfter], ['applied', [superAdminRole], ['user']]);
    });

    test('Given a membership whose only grant is Super Admin, when the operator revokes it, then the membership stays active with only the default role, which gives no application permission: the organization service lists no organization for the identity, and the identity stays', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['sole-super-admin'];
      const organizationId = fixtures.operatorOrganization.id;
      const service = new OrganizationAdministration({ directory, records: { record: () => {} }, billing: new BillingFree() });
      const identity = { authority: workosAuthority(settings.clientId), subject: user.id };
      const listedBefore = await service.listOrganizations(identity);

      const revoked = await fixtures.runbook.revokeSuperAdmin({ organizationId, email: user.email });
      const membership = await membershipOf(fixtures, user);
      const listedAfter = await service.listOrganizations(identity);
      describeRecord(t, revoked);

      assert.deepEqual(listedBefore.map(({ organizationId: listed }) => listed), [organizationId]);
      assert.deepEqual([revoked.outcome, revoked.rolesAfter], ['applied', ['member']]);
      assert.equal(membership?.status, 'active');
      assert.deepEqual(await directory.activeGrants(user.id, organizationId), [{ role: 'member', permissions: [] }]);
      assert.deepEqual(listedAfter, []);
      assert.equal((await workos.userManagement.getUser(user.id)).id, user.id);
    });

    test('Given a Super Admin that also has User, when the operator replaces it with another verified identity, then the new identity gets Super Admin first, so that the organization keeps a Super Admin at each step, and the old identity loses only Super Admin and keeps User', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const { outgoing, incoming } = fixtures.users;
      const organizationId = fixtures.operatorOrganization.id;

      const added = await fixtures.runbook.grantSuperAdmin({ organizationId, email: incoming.email });
      const bothSuperAdmins = [rolesOf(await membershipOf(fixtures, outgoing)), rolesOf(await membershipOf(fixtures, incoming))];
      const removed = await fixtures.runbook.revokeSuperAdmin({ organizationId, email: outgoing.email });
      describeRecord(t, added);
      describeRecord(t, removed);

      assert.equal(added.outcome, 'applied');
      assert.deepEqual(bothSuperAdmins, [[superAdminRole, 'user'], [superAdminRole]]);
      assert.deepEqual([removed.outcome, removed.rolesAfter], ['applied', ['user']]);
      assert.deepEqual(await directory.activeGrants(outgoing.id, organizationId), [{ role: 'user', permissions: ['product:access'] }]);
      assert.deepEqual(await directory.activeGrants(incoming.id, organizationId), [superAdminGrant]);
    });

    test('Given an organization whose only Super Admin lost access because its membership is inactive, when the operator recovers it, then the grant for the inactive membership stops without a create or a reactivation, and another verified identity gets Super Admin', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const { lost, recovering } = fixtures.users;
      const organizationId = fixtures.operatorOrganization.id;

      const stopped = await fixtures.runbook.grantSuperAdmin({ organizationId, email: lost.email });
      const lostMembership = await membershipOf(fixtures, lost);
      const recovered = await fixtures.runbook.grantSuperAdmin({ organizationId, email: recovering.email });
      describeRecord(t, stopped);
      describeRecord(t, recovered);

      assert.equal(stopped.outcome, 'stopped');
      assert.match(stopped.reason ?? '', /inactive/);
      assert.deepEqual([lostMembership?.status, rolesOf(lostMembership)], ['inactive', [superAdminRole]]);
      assert.equal(await directory.activeGrants(lost.id, organizationId), undefined);
      assert.equal(recovered.outcome, 'applied');
      assert.deepEqual(await directory.activeGrants(recovering.id, organizationId), [superAdminGrant]);
    });

    test('Given a Super Admin grant whose outcome the operator does not know and a later User grant, when the operator retries, then it inspects first and writes nothing for a grant in place, and a blind create would leave both grants; after a later revocation, the inspection stops without a write, so that the removed grant stays removed', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['unknown-outcome'];
      const organizationId = fixtures.operatorOrganization.id;
      const request = { organizationId, email: user.email };
      await fixtures.runbook.grantSuperAdmin(request);
      const granted = await membershipOf(fixtures, user);
      assert.ok(granted, 'The grant made no membership.');
      await workos.authorization.assignRole(organizationRole(fixtures, granted, 'user'));

      const inPlace = await fixtures.runbook.inspectAfterUnknownOutcome(request);
      const blindCreate = await workos.userManagement.createOrganizationMembership({ organizationId, userId: user.id, roleSlugs: [superAdminRole] }).then(() => undefined, (error: unknown) => error);
      const afterBlindCreate = await workos.userManagement.listOrganizationMemberships({ userId: user.id, organizationId, statuses: ['active', 'inactive', 'pending'], limit: 10 });
      await fixtures.runbook.revokeSuperAdmin(request);
      const afterRevocation = await fixtures.runbook.inspectAfterUnknownOutcome(request);
      const membership = await membershipOf(fixtures, user);
      t.diagnostic(`a create for the active membership: ${blindCreate === undefined ? 'accepted' : `refused with HTTP ${String(statusOf(blindCreate))} ${String(codeOf(blindCreate))}`}`);
      describeRecord(t, inPlace);
      describeRecord(t, afterRevocation);

      assert.deepEqual([inPlace.outcome, inPlace.rolesAfter], ['applied', [superAdminRole, 'user']]);
      assert.deepEqual(afterBlindCreate.data.map((found) => [found.id, found.status, rolesOf(found)]), [[granted.id, 'active', [superAdminRole, 'user']]]);
      assert.equal(afterRevocation.outcome, 'stopped');
      assert.match(afterRevocation.reason ?? '', /removed later/);
      assert.deepEqual([membership?.status, rolesOf(membership)], ['active', ['user']]);
    });

    test('Given an inactive membership, when the operator retries a Super Admin grant after an unknown outcome, then the inspection finds it with the explicit statuses and stops without a create or a reactivation, and the membership stays inactive with its roles', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['inactive-retry'];
      const organizationId = fixtures.operatorOrganization.id;
      const active = await workos.userManagement.listOrganizationMemberships({ userId: user.id, organizationId, statuses: ['active'], limit: 10 });

      const inspected = await fixtures.runbook.inspectAfterUnknownOutcome({ organizationId, email: user.email });
      const granted = await fixtures.runbook.grantSuperAdmin({ organizationId, email: user.email });
      const membership = await membershipOf(fixtures, user);
      describeRecord(t, inspected);

      assert.deepEqual(active.data, [], 'A read with the status active alone found the inactive membership.');
      assert.deepEqual([inspected.outcome, granted.outcome], ['stopped', 'stopped']);
      assert.match(inspected.reason ?? '', /no reactivation/);
      assert.deepEqual([membership?.status, rolesOf(membership)], ['inactive', ['user']]);
    });

    test('Given the records of the operator steps of this run, when they are read, then each names the actor, the organization, the target, the action, the time, and the outcome, each grant change names the roles before and after, and no record holds a credential', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      await fixtures.runbook.inspectAfterUnknownOutcome({ organizationId: fixtures.operatorOrganization.id, email: fixtures.users['new-super-admin'].email });
      const { records } = fixtures.runbook;
      const text = JSON.stringify(records);
      const passwords = Object.values(fixtures.users).map(({ password }) => password);
      t.diagnostic(`records: ${records.length}; outcomes ${JSON.stringify(records.map(({ outcome }) => outcome))}`);

      assert.ok(records.length >= 2, 'The run kept no records.');
      for (const record of records) {
        for (const field of recordFields) assert.ok(field in record, `A record has no ${field}: ${JSON.stringify(record)}`);
        assert.equal(record.actor, 'operator:hosted-live-gate');
        assert.ok(!Number.isNaN(Date.parse(record.time)), `The record time ${record.time} is not a time.`);
        if (record.action === 'grant-super-admin' || record.action === 'revoke-super-admin') assert.ok(record.rolesBefore !== undefined, `A grant change has no roles before: ${JSON.stringify(record)}`);
      }
      assert.ok(!text.includes(settings.apiKey), 'A record holds the API key.');
      assert.ok(passwords.every((password) => !text.includes(password)), 'A record holds a password.');
      assert.doesNotMatch(text, /sk_(?:test|live)_|Bearer |eyJ[\w-]+\./);
    });
  });
}
