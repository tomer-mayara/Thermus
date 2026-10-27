import assert from 'node:assert/strict';
import test from 'node:test';
import { OrganizationAdministration } from '../../../src/accounts/organizations/organization-administration.ts';
import { BillingFree } from '../../../src/accounts/billing/billing-free.ts';
import { PgDestinationSettingsStore } from '../../../src/logs/audit/pg-destination-settings-store.ts';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { composeLoggingStorage } from '../../../src/app/logging-storage.ts';
import { OrganizationDirectoryDouble } from '../../support/doubles/organizations/organization-directory-double.ts';
import { adminGrant, userGrant } from '../../support/fixtures/hosted-roles.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

test('Given two password-only Admins and separate SQL pools, when one removal is admitted, then another instance is busy, another organization proceeds, and the remaining Admin cannot remove itself', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const firstRuntime = createPgSettingsRuntime({ ...site.connection, bounds: { active: 1, pending: 0 } });
  const secondRuntime = createPgSettingsRuntime(site.connection);
  t.after(() => Promise.all([firstRuntime.close(), secondRuntime.close()]));
  const firstStore = new PgDestinationSettingsStore(firstRuntime);
  const secondStore = new PgDestinationSettingsStore(secondRuntime);
  const firstStorage = composeLoggingStorage({ store: firstStore, removalStore: firstStore, close: () => firstRuntime.close() }, Buffer.alloc(32, 7));
  const secondStorage = composeLoggingStorage({ store: secondStore, removalStore: secondStore, close: () => secondRuntime.close() }, Buffer.alloc(32, 7));
  t.after(() => Promise.all([firstStorage.close(), secondStorage.close()]));
  assert.ok(firstStorage.removalStore, 'Hosted storage must supply durable removal admission');
  assert.ok(secondStorage.removalStore);
  const directory = new OrganizationDirectoryDouble();
  directory.authority = 'removal-provider';
  directory.addMembers(
    { subject: 'admin-a', organizationId: 'org-a', membershipId: 'admin-a-in-a', grants: [adminGrant] },
    { subject: 'admin-b', organizationId: 'org-a', membershipId: 'admin-b-in-a', grants: [adminGrant] },
    { subject: 'admin-a', organizationId: 'org-b', membershipId: 'admin-a-in-b', grants: [adminGrant] },
    { subject: 'user-c', organizationId: 'org-b', membershipId: 'user-c-in-b', grants: [userGrant] },
  );
  const common = { directory, records: { record: () => { throw new Error('Recording unavailable'); } }, billing: new BillingFree() };
  const firstOptions = { ...common, removalStore: firstStorage.removalStore };
  const secondOptions = { ...common, removalStore: secondStorage.removalStore };
  const first = new OrganizationAdministration(firstOptions);
  const second = new OrganizationAdministration(secondOptions);
  t.after(() => Promise.all([first.close(), second.close()]));
  const reached = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const deletes: string[] = [];
  const original = directory.deleteMembership.bind(directory);
  t.mock.method(directory, 'deleteMembership', async (membershipId: string) => {
    deletes.push(membershipId);
    if (membershipId === 'admin-b-in-a') {
      const saved = await secondStore.readRemoval('org-a');
      assert.equal(saved.status, 'found');
      assert.equal(saved.operation.membershipId, membershipId);
      assert.equal(saved.operation.outcome, null);
      assert.equal(await site.settingsConnections(true), 0, 'SQL work must finish before provider dispatch');
      reached.resolve();
      await release.promise;
    }
    return original(membershipId);
  });
  const actor = { user: { authority: 'removal-provider', subject: 'admin-a', selectedOrganizationId: 'org-b' } };
  const removing = first.removeMember(actor, { organizationId: 'org-a', membershipId: 'admin-b-in-a', revision: 'r1' });
  await reached.promise;
  assert.equal(await second.removeMember(actor, { organizationId: 'org-a', membershipId: 'admin-a-in-a', revision: 'r1' }), 'busy');
  assert.equal(await first.removeMember(actor, { organizationId: 'org-b', membershipId: 'user-c-in-b', revision: 'r1' }), 'applied', 'The same one-slot SQL runtime must be free while the provider is paused');
  release.resolve();
  assert.equal(await removing, 'applied');
  assert.equal(await second.removeMember(actor, { organizationId: 'org-a', membershipId: 'admin-a-in-a', revision: 'r1' }), 'last-admin');
  assert.deepEqual(deletes, ['admin-b-in-a', 'user-c-in-b']);
  assert.ok(directory.membershipIn('admin-a', 'org-a'));
});

test('Given a committed removal whose provider reply is lost and whose recorder fails, when SQL and the coordinator reopen, then the same organization stays busy without replaying deletion', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const directory = new OrganizationDirectoryDouble();
  directory.authority = 'removal-provider';
  directory.addMembers(
    { subject: 'admin-a', organizationId: 'org-a', membershipId: 'admin-a-in-a', grants: [adminGrant] },
    { subject: 'admin-b', organizationId: 'org-a', membershipId: 'admin-b-in-a', grants: [adminGrant] },
  );
  const common = { directory, records: { record: () => { throw new Error('Recording unavailable'); } }, billing: new BillingFree() };
  const options = { ...common, removalStore: new PgDestinationSettingsStore(runtime) };
  const first = new OrganizationAdministration(options);
  t.after(() => first.close());
  let deletes = 0;
  const original = directory.deleteMembership.bind(directory);
  t.mock.method(directory, 'deleteMembership', async (membershipId: string) => {
    deletes += 1;
    await original(membershipId);
    throw new Error('Provider reply was lost after deletion');
  });
  const actor = { user: { authority: 'removal-provider', subject: 'admin-a' } };
  assert.equal(await first.removeMember(actor, { organizationId: 'org-a', membershipId: 'admin-b-in-a', revision: 'r1' }), 'unknown');
  await first.close();
  await runtime.close();
  const reopened = createPgSettingsRuntime(site.connection);
  t.after(() => reopened.close());
  const nextOptions = { ...common, removalStore: new PgDestinationSettingsStore(reopened) };
  const next = new OrganizationAdministration(nextOptions);
  t.after(() => next.close());
  assert.equal(await next.removeMember(actor, { organizationId: 'org-a', membershipId: 'admin-a-in-a', revision: 'r1' }), 'busy');
  assert.equal(deletes, 1);
  assert.equal(directory.membershipIn('admin-b', 'org-a'), undefined);
  assert.ok(directory.membershipIn('admin-a', 'org-a'));
});
