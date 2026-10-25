import type { AuthenticatedUser } from '../identity/access-context.ts';
import type { OrganizationDirectory } from './organization-directory.ts';
import { checkRemoval, currentAdmin } from './membership-removal-checks.ts';
import { RemovalLifetime } from './membership-removal-lifetime.ts';
import type { MemberRemovalRequest, RemovalIntent, RemovalOperationStore, RemovalResult, RemovalTerminal } from './removal-operation-store.ts';

export class MembershipRemoval {
  private readonly directory: OrganizationDirectory;
  private readonly store?: RemovalOperationStore;
  private readonly clock: () => Date;
  private readonly active = new Set<RemovalLifetime>();
  private closed = false;

  constructor(directory: OrganizationDirectory, store: RemovalOperationStore | undefined, clock: () => Date) {
    this.directory = directory;
    this.store = store;
    this.clock = clock;
  }

  async remove(user: AuthenticatedUser, request: MemberRemovalRequest): Promise<RemovalResult> {
    if (this.closed) return 'unavailable';
    const lifetime = new RemovalLifetime();
    this.active.add(lifetime);
    try {
      return await lifetime.run(() => this.admit(user, request, lifetime));
    } finally {
      this.active.delete(lifetime);
    }
  }

  close(): Promise<void> {
    this.closed = true;
    for (const lifetime of this.active) lifetime.stop();
    return Promise.resolve();
  }

  private async admit(user: AuthenticatedUser, request: MemberRemovalRequest, lifetime: RemovalLifetime): Promise<RemovalResult> {
    if (!currentAdmin(await lifetime.wait(signal => this.directory.membershipsOf(user, signal)), request.organizationId)) return 'denied';
    if (this.store === undefined) return 'unavailable';
    const store = this.store;
    const intent: RemovalIntent = { ...request, operationId: crypto.randomUUID(), actor: { authority: user.authority, subject: user.subject }, startedAt: this.clock().toISOString() };
    lifetime.admitting();
    const admission = await lifetime.wait(() => store.admitRemoval(intent));
    if (admission.status === 'unconfirmed') return 'unknown';
    if (admission.status !== 'admitted') return admission.status;
    return this.admitted(user, request, intent, store, lifetime);
  }

  private async admitted(user: AuthenticatedUser, request: MemberRemovalRequest, intent: RemovalIntent, store: RemovalOperationStore, lifetime: RemovalLifetime): Promise<RemovalResult> {
    try {
      const refusal = await checkRemoval(this.directory, user, request, read => lifetime.wait(read));
      if (refusal !== undefined) return this.complete(store, intent, 'no-effect', refusal, lifetime);
    } catch {
      return this.complete(store, intent, 'no-effect', 'unavailable', lifetime);
    }
    try {
      const result = await lifetime.wait(() => this.directory.deleteMembership(request.membershipId));
      if (result.outcome === 'applied') return this.complete(store, intent, 'applied', 'applied', lifetime);
      if (result.outcome === 'unsupported') return this.complete(store, intent, 'no-effect', 'unsupported', lifetime);
    } catch {
      return 'unknown';
    }
    return 'unknown';
  }

  private async complete(store: RemovalOperationStore, intent: RemovalIntent, terminal: RemovalTerminal, result: RemovalResult, lifetime: RemovalLifetime): Promise<RemovalResult> {
    try {
      const completed = await lifetime.wait(() => store.completeRemoval(intent.organizationId, intent.operationId, terminal));
      if (completed.status === 'completed') return result;
      if (completed.status === 'mismatch') return 'unknown';
    } catch { /* Read the durable receipt before a success claim. */ }
    try {
      const receipt = await lifetime.wait(() => store.readRemoval(intent.organizationId));
      if (receipt.status === 'found' && receipt.operation.organizationId === intent.organizationId
        && receipt.operation.operationId === intent.operationId && receipt.operation.outcome === terminal) return result;
    } catch { /* A missing receipt cannot prove completion. */ }
    return 'unknown';
  }
}
