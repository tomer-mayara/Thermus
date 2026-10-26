import { OrganizationAdministration } from '../../../src/accounts/organizations/organization-administration.ts';
import { BillingFree } from '../../../src/accounts/billing/billing-free.ts';
import type { RemovalOperationStore } from '../../../src/accounts/organizations/removal-operation-store.ts';
import { PgDestinationSettingsStore } from '../../../src/logs/audit/pg-destination-settings-store.ts';
import { createPgSettingsRuntime } from '../../../src/logs/audit/bounded-sql-runtime.ts';
import { OrganizationDirectoryDouble } from '../doubles/organizations/organization-directory-double.ts';
import { adminGrant } from '../fixtures/hosted-roles.ts';

interface Start {
  kind: 'start';
  connection: { connectionString: string; ca: string };
  stage: 'after-admission' | 'during-provider' | 'before-completion' | 'restart';
}

async function run(start: Start): Promise<void> {
  const runtime = createPgSettingsRuntime(start.connection);
  const durable = new PgDestinationSettingsStore(runtime);
  let deleteCalls = 0;
  let operationId: string | undefined;
  const pause = async (completionOutcome?: string): Promise<never> => {
    process.send?.({ kind: 'paused', stage: start.stage, deleteCalls, operationId, completionOutcome });
    return new Promise<never>(() => {});
  };
  const store: RemovalOperationStore = {
    admitRemoval: async intent => {
      const result = await durable.admitRemoval(intent);
      if (result.status === 'admitted') {
        operationId = intent.operationId;
        if (start.stage === 'after-admission') await pause();
      }
      return result;
    },
    readRemoval: organizationId => durable.readRemoval(organizationId),
    completeRemoval: async (...args) => {
      if (start.stage === 'before-completion') await pause(args[2]);
      return durable.completeRemoval(...args);
    },
  };
  const directory = new OrganizationDirectoryDouble();
  directory.authority = 'removal-restart-provider';
  directory.addMembers(
    { subject: 'admin-a', organizationId: 'org-a', membershipId: 'admin-a-in-a', grants: [adminGrant] },
    { subject: 'admin-b', organizationId: 'org-a', membershipId: 'admin-b-in-a', grants: [adminGrant] },
  );
  const original = directory.deleteMembership.bind(directory);
  directory.deleteMembership = async membershipId => {
    deleteCalls++;
    if (start.stage === 'during-provider') await pause();
    return original(membershipId);
  };
  const administration = new OrganizationAdministration({ directory, billing: new BillingFree(), records: { record: () => {} }, removalStore: store });
  try {
    const actor = { user: { authority: 'removal-restart-provider', subject: 'admin-a' } };
    if (start.stage === 'restart') await administration.memberOverview(actor, 'org-a');
    const result = await administration.removeMember(actor, {
      organizationId: 'org-a', membershipId: start.stage === 'restart' ? 'admin-a-in-a' : 'admin-b-in-a', revision: 'r1',
    });
    process.send?.({ kind: 'result', result, deleteCalls, membershipReads: directory.membershipReads.length, memberPageReads: directory.memberPageReads.length });
  } finally {
    await administration.close();
    await runtime.close();
  }
}

process.once('message', (message: Start) => {
  void run(message).catch((error: unknown) => {
    // Keep connection details and provider data out of child failure output.
    process.send?.({ kind: 'failed', stage: message.stage, errorKind: error instanceof Error ? error.name : 'unknown' });
    process.exitCode = 1;
  }).finally(() => { process.disconnect?.(); });
});
