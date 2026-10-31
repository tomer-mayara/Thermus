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
    return this.admitted(user, new AdmittedRemoval(store, intent, lifetime));
  }

  private async admitted(user: AuthenticatedUser, removal: AdmittedRemoval): Promise<RemovalResult> {
    try {
      const refusal = await checkRemoval(user, removal.intent, read => removal.wait(signal => read(this.directory, signal)));
      if (refusal !== undefined) return removal.complete('no-effect', refusal);
    } catch {
      return removal.complete('no-effect', 'unavailable');
    }
    try {
      const result = await removal.wait(() => this.directory.deleteMembership(removal.intent.membershipId));
      if (result.outcome === 'applied') return removal.complete('applied', 'applied');
      if (result.outcome === 'unsupported') return removal.complete('no-effect', 'unsupported');
    } catch {
      return 'unknown';
    }
    return 'unknown';
  }
}

class AdmittedRemoval {
  readonly intent: RemovalIntent;
  private readonly store: RemovalOperationStore;
  private readonly lifetime: RemovalLifetime;

  constructor(store: RemovalOperationStore, intent: RemovalIntent, lifetime: RemovalLifetime) {
    this.store = store;
    this.intent = intent;
    this.lifetime = lifetime;
  }

  wait<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return this.lifetime.wait(work);
  }

  async complete(terminal: RemovalTerminal, result: RemovalResult): Promise<RemovalResult> {
    const { store, intent } = this;
    try {
      const completed = await this.wait(() => store.completeRemoval(intent.organizationId, intent.operationId, terminal));
      if (completed.status === 'completed') return result;
      if (completed.status === 'mismatch') return 'unknown';
    } catch { /* Read the durable receipt before a success claim. */ }
    try {
      const receipt = await this.wait(() => store.readRemoval(intent.organizationId));
      if (receipt.status === 'found' && receipt.operation.organizationId === intent.organizationId
        && receipt.operation.operationId === intent.operationId && receipt.operation.outcome === terminal) return result;
    } catch { /* A missing receipt cannot prove completion. */ }
    return 'unknown';
  }
}
