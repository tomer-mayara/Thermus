import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { OperatorRunbook } from '../../support/hosted-live/operator-runbook.ts';
import { acme, RunbookClientDouble, sam } from './fixtures/runbook-client-double.ts';

const request = { organizationId: acme.id, email: sam.email };
const superAdminOnAcme = { organizationMembershipId: 'om_01SAM', roleSlug: 'super-admin', resourceTypeSlug: 'organization', resourceExternalId: 'thermus-customer-0042' };
const differs = 'the membership differs from the change';

function runbookFor(client: RunbookClientDouble): OperatorRunbook {
  return new OperatorRunbook(client, 'operator:unit-test');
}

function stepsOf(runbook: OperatorRunbook): string[] {
  return runbook.records.map(({ action, outcome }) => `${action} ${outcome}`);
}

describe('Operator runbook driver (test support) with an SDK double', () => {
  test('Given an active membership with User and Admin, when the operator grants Super Admin, then the runbook sends one role assignment of super-admin on the organization resource with the external ID of the organization, no other write, and records applied with the roles before and after', async () => {
    const client = new RunbookClientDouble(['user', 'admin']);

    const record = await runbookFor(client).grantSuperAdmin(request);

    assert.deepEqual(client.writes, [{ assignRole: superAdminOnAcme }]);
    assert.deepEqual([record.action, record.outcome, record.rolesBefore, record.rolesAfter], ['grant-super-admin', 'applied', ['admin', 'user'], ['admin', 'super-admin', 'user']]);
  });

  test('Given a membership with Super Admin, when the operator revokes it, then the runbook sends one removal of super-admin on the organization resource and no other write; the other role stays, and without another role the default role counts as applied', async () => {
    const withUser = new RunbookClientDouble(['super-admin', 'user']);
    const alone = new RunbookClientDouble(['super-admin']);

    const revoked = await runbookFor(withUser).revokeSuperAdmin(request);
    const revokedAlone = await runbookFor(alone).revokeSuperAdmin(request);

    assert.deepEqual([withUser.writes, alone.writes], [[{ removeRole: superAdminOnAcme }], [{ removeRole: superAdminOnAcme }]]);
    assert.deepEqual([revoked.outcome, revoked.rolesBefore, revoked.rolesAfter], ['applied', ['super-admin', 'user'], ['user']]);
    assert.deepEqual([revokedAlone.outcome, revokedAlone.rolesAfter], ['applied', ['member']]);
  });

  test('Given a customer change of another role at the same time as the operator write, when the runbook verifies its grant or revocation, then the change of super-admin with the other changed roles counts as applied, and the record keeps the current roles', async () => {
    const grant = new RunbookClientDouble(['user', 'admin']);
    grant.atWrite = (effect) => {
      grant.roles = ['user'];
      effect();
    };
    const revoke = new RunbookClientDouble(['super-admin']);
    revoke.atWrite = (effect) => {
      revoke.roles = ['super-admin', 'user'];
      effect();
    };

    const granted = await runbookFor(grant).grantSuperAdmin(request);
    const revoked = await runbookFor(revoke).revokeSuperAdmin(request);

    assert.deepEqual([granted.outcome, granted.rolesBefore, granted.rolesAfter], ['applied', ['admin', 'user'], ['super-admin', 'user']]);
    assert.deepEqual([revoked.outcome, revoked.rolesBefore, revoked.rolesAfter], ['applied', ['super-admin'], ['user']]);
  });

  test('Given an identity without a membership, when the operator grants Super Admin, then the runbook creates the membership with only super-admin', async () => {
    const client = new RunbookClientDouble(undefined);

    const record = await runbookFor(client).grantSuperAdmin(request);

    assert.deepEqual(client.writes, [{ create: { organizationId: acme.id, userId: sam.id, roleSlugs: ['super-admin'] } }]);
    assert.deepEqual([record.outcome, record.rolesBefore, record.rolesAfter], ['applied', [], ['super-admin']]);
  });

  test('Given an inactive or a pending membership, when the operator grants or revokes Super Admin or inspects after an unknown outcome, then each step stops without a write; a grant in place and an absent grant for a revocation give unchanged without a write', async () => {
    for (const status of ['inactive', 'pending'] as const) {
      const client = new RunbookClientDouble(['super-admin', 'user'], status);
      const runbook = runbookFor(client);

      const records = [await runbook.grantSuperAdmin(request), await runbook.revokeSuperAdmin(request), await runbook.inspectAfterUnknownOutcome(request)];

      assert.deepEqual(records.map(({ outcome }) => outcome), ['stopped', 'stopped', 'stopped'], status);
      assert.ok(records.every(({ reason }) => reason?.includes(`the membership is ${status}`)), status);
      assert.deepEqual(client.writes, [], status);
    }
    const inPlace = new RunbookClientDouble(['super-admin', 'user']);
    const absent = new RunbookClientDouble(['user']);
    const withoutMembership = new RunbookClientDouble(undefined);

    const outcomes = [
      (await runbookFor(inPlace).grantSuperAdmin(request)).outcome,
      (await runbookFor(absent).revokeSuperAdmin(request)).outcome,
      (await runbookFor(withoutMembership).revokeSuperAdmin(request)).outcome,
    ];

    assert.deepEqual(outcomes, ['unchanged', 'unchanged', 'unchanged']);
    assert.deepEqual([...inPlace.writes, ...absent.writes, ...withoutMembership.writes], []);
  });

  test('Given a membership that someone deactivates during the grant, or a Super Admin grant that someone removes at once, when the runbook verifies its write, then the record is unknown', async () => {
    const deactivated = new RunbookClientDouble(['user']);
    deactivated.atWrite = (effect) => {
      effect();
      deactivated.status = 'inactive';
    };
    const removed = new RunbookClientDouble(['user']);
    removed.atWrite = (effect) => {
      effect();
      removed.roles = ['user'];
    };

    const records = [await runbookFor(deactivated).grantSuperAdmin(request), await runbookFor(removed).grantSuperAdmin(request)];

    assert.deepEqual(records.map(({ outcome, reason }) => [outcome, reason]), [['unknown', differs], ['unknown', differs]]);
  });

  test('Given a grant write that fails before or after its effect, when the operator inspects after the unknown outcome, then the runbook records unknown for the write, sends no second write, and records applied for a grant in place and stopped for an absent grant', async () => {
    const answerLost = new RunbookClientDouble(['user']);
    answerLost.atWrite = (effect) => {
      effect();
      throw new Error('The answer was lost.');
    };
    const failed = new RunbookClientDouble(['user']);
    failed.atWrite = () => {
      throw new Error('The write failed.');
    };

    for (const [client, inspection] of [[answerLost, 'applied'], [failed, 'stopped']] as const) {
      const runbook = runbookFor(client);
      await assert.rejects(runbook.grantSuperAdmin(request));
      await runbook.inspectAfterUnknownOutcome(request);

      assert.deepEqual(client.writes, [{ assignRole: superAdminOnAcme }]);
      assert.deepEqual(stepsOf(runbook), ['grant-super-admin unknown', `inspect-after-unknown-outcome ${inspection}`]);
    }
  });

  test('Given an organization without an external ID, when the operator grants or revokes Super Admin, then the runbook stops before a write, because the authorization resource of a runbook organization has the external ID of the operator', async () => {
    const grant = new RunbookClientDouble(['user']);
    const revoke = new RunbookClientDouble(['super-admin']);
    for (const client of [grant, revoke]) client.organization = { ...acme, externalId: null };

    await assert.rejects(runbookFor(grant).grantSuperAdmin(request), /no external ID/);
    await assert.rejects(runbookFor(revoke).revokeSuperAdmin(request), /no external ID/);

    assert.deepEqual([...grant.writes, ...revoke.writes], []);
  });
});
