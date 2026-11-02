import type { RemovalIntent, RemovalOperation, RemovalOperationStore, RemovalStore, RemovalTerminal, RemovedMember, RemovedMemberStore } from '../../../../src/accounts/organizations/removal-operation-store.ts';

export class RemovalOperationStoreFake implements RemovalStore {
  readonly operations = new Map<string, RemovalOperation>();
  readonly admissions: RemovalIntent[] = [];
  // Each confirmed record, in order. A scripted answer replaces the confirmation or the read.
  readonly removedMembers: RemovedMember[] = [];
  recordAnswer?: 'unavailable' | 'unconfirmed';
  readAnswer?: 'unavailable';

  async admitRemoval(intent: RemovalIntent): ReturnType<RemovalOperationStore['admitRemoval']> {
    if (this.operations.get(intent.organizationId)?.outcome === null) return { status: 'busy' };
    this.admissions.push(intent);
    this.operations.set(intent.organizationId, { ...intent, outcome: null });
    return { status: 'admitted' };
  }

  async readRemoval(organizationId: string): ReturnType<RemovalOperationStore['readRemoval']> {
    const operation = this.operations.get(organizationId);
    return operation === undefined ? { status: 'absent' } : { status: 'found', operation };
  }

  async completeRemoval(organizationId: string, operationId: string, outcome: RemovalTerminal): ReturnType<RemovalOperationStore['completeRemoval']> {
    const operation = this.operations.get(organizationId);
    if (operation?.operationId !== operationId || (operation.outcome !== null && operation.outcome !== outcome)) return { status: 'mismatch' };
    this.operations.set(organizationId, { ...operation, outcome });
    return { status: 'completed' };
  }

  async recordRemovedMember(record: RemovedMember): ReturnType<RemovedMemberStore['recordRemovedMember']> {
    if (this.recordAnswer !== undefined) return { status: this.recordAnswer };
    this.removedMembers.push(record);
    return { status: 'recorded' };
  }

  async readRemovedMember(identity: { readonly authority: string; readonly subject: string }): ReturnType<RemovedMemberStore['readRemovedMember']> {
    if (this.readAnswer !== undefined) return { status: this.readAnswer };
    return { status: this.removedMembers.some((member) => member.authority === identity.authority && member.subject === identity.subject) ? 'found' : 'absent' };
  }
}
