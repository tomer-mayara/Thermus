import type { ChangeRecord } from '../../../../src/accounts/organizations/change-records.ts';
import { OrganizationAdministration, type Actor } from '../../../../src/accounts/organizations/organization-administration.ts';
import type { RemovalIntent, RemovalOperation, RemovalOperationStore, RemovalTerminal } from '../../../../src/accounts/organizations/removal-operation-store.ts';
import { OrganizationDirectoryDouble } from '../../../support/doubles/organizations/organization-directory-double.ts';
import { adminGrant, userGrant } from '../../../support/fixtures/hosted-roles.ts';
import { BillingDouble } from './billing-double.ts';
import type { TestContext } from 'node:test';

export const actor: Actor = { user: { authority: 'provider', subject: 'admin-a', selectedOrganizationId: 'other-org' } };
export const request = { organizationId: 'org-a', membershipId: 'member-b', revision: 'r1' };

export class RemovalStoreFake implements RemovalOperationStore {
  readonly operations = new Map<string, RemovalOperation>();
  readonly admissions: RemovalIntent[] = [];
  readonly completions: { organizationId: string; operationId: string; outcome: RemovalTerminal }[] = [];

  async admitRemoval(intent: RemovalIntent): ReturnType<RemovalOperationStore['admitRemoval']> {
    this.admissions.push(intent);
    if (this.operations.get(intent.organizationId)?.outcome === null) return { status: 'busy' };
    this.operations.set(intent.organizationId, { ...intent, outcome: null });
    return { status: 'admitted' };
  }

  async readRemoval(organizationId: string): ReturnType<RemovalOperationStore['readRemoval']> {
    const operation = this.operations.get(organizationId);
    return operation ? { status: 'found', operation } : { status: 'absent' };
  }

  async completeRemoval(organizationId: string, operationId: string, outcome: RemovalTerminal): ReturnType<RemovalOperationStore['completeRemoval']> {
    this.completions.push({ organizationId, operationId, outcome });
    const operation = this.operations.get(organizationId);
    if (operation?.operationId !== operationId || (operation.outcome !== null && operation.outcome !== outcome)) return { status: 'mismatch' };
    this.operations.set(organizationId, { ...operation, outcome });
    return { status: 'completed' };
  }
}

export function removalFixture() {
  const directory = new OrganizationDirectoryDouble();
  directory.authority = actor.user.authority;
  directory.addMembers(
    { subject: actor.user.subject, organizationId: request.organizationId, membershipId: 'member-a', grants: [adminGrant] },
    { subject: 'admin-b', organizationId: request.organizationId, membershipId: request.membershipId, grants: [adminGrant] },
    { subject: 'user-c', organizationId: request.organizationId, membershipId: 'member-c', grants: [userGrant] },
  );
  const store = new RemovalStoreFake();
  const records: ChangeRecord[] = [];
  const options = { directory, removalStore: store, records: { record: (entry: ChangeRecord) => { records.push(entry); } }, billing: new BillingDouble(), clock: () => new Date('2026-10-25T00:00:00.000Z') };
  const administration = new OrganizationAdministration(options);
  const deletes: string[] = [];
  const original = directory.deleteMembership.bind(directory);
  directory.deleteMembership = async (membershipId) => { deletes.push(membershipId); return original(membershipId); };
  return { directory, store, records, administration, deletes, options };
}

export function removalTime(t: TestContext) {
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return { advance: (milliseconds: number) => { now += milliseconds; t.mock.timers.tick(milliseconds); } };
}

export function nextTurn(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}
