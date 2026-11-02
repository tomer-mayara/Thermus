export interface MemberRemovalRequest {
  readonly organizationId: string;
  readonly membershipId: string;
  readonly revision: string;
}

export type RemovalResult = 'applied' | 'denied' | 'stale' | 'unsupported' | 'last-admin' | 'busy' | 'unavailable' | 'unknown';

export interface RemovalIntent {
  readonly organizationId: string;
  readonly operationId: string;
  readonly membershipId: string;
  readonly revision: string;
  readonly actor: { readonly authority: string; readonly subject: string };
  readonly startedAt: string;
}

export type RemovalTerminal = 'applied' | 'no-effect';
export type RemovalOperation = RemovalIntent & { readonly outcome: RemovalTerminal | null };

export interface RemovalOperationStore {
  admitRemoval(intent: RemovalIntent): Promise<{ status: 'admitted' | 'busy' | 'unavailable' | 'unconfirmed' }>;
  readRemoval(organizationId: string): Promise<{ status: 'found'; operation: RemovalOperation } | { status: 'absent' | 'unavailable' }>;
  completeRemoval(organizationId: string, operationId: string, outcome: RemovalTerminal): Promise<{ status: 'completed' | 'mismatch' | 'unavailable' | 'unconfirmed' }>;
}

// A member that Thermus removed from an organization, kept before the deletion at the provider, which keeps no record
// of a deleted membership. Free access reads it: a person who had a membership cannot create a new organization.
export interface RemovedMember {
  readonly authority: string;
  readonly subject: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly operationId: string;
  readonly recordedAt: string;
}

export interface RemovedMemberStore {
  // A record of the same membership again is recorded, so that a retry after an unconfirmed write can continue.
  recordRemovedMember(record: RemovedMember): Promise<{ status: 'recorded' | 'unavailable' | 'unconfirmed' }>;
  // Whether a record of this identity exists, in any organization.
  readRemovedMember(identity: { readonly authority: string; readonly subject: string }): Promise<{ status: 'found' | 'absent' | 'unavailable' }>;
}

// The one durable store of the removal: its operation of each organization and its removed members.
export type RemovalStore = RemovalOperationStore & RemovedMemberStore;
