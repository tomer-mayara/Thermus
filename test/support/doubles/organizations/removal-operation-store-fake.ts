import type { RemovalIntent, RemovalOperation, RemovalOperationStore, RemovalTerminal } from '../../../../src/accounts/organizations/removal-operation-store.ts';

export class RemovalOperationStoreFake implements RemovalOperationStore {
  readonly operations = new Map<string, RemovalOperation>();
  readonly admissions: RemovalIntent[] = [];

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
}
