import type { AuthenticatedUser } from '../identity/access-context.ts';

// 'unchanged': the same invitation is already pending, so no change was necessary. 'address-in-use': the
// directory sent no invitation, because the address belongs to a member or has a pending invitation. 'limit-reached':
// no invitation was sent, because the seats of the plan are all used.
export type ChangeResult = 'applied' | 'unchanged' | 'denied' | 'stale' | 'not-pending' | 'address-in-use' | 'limit-reached' | 'unsupported';

// 'failed' means no directory write started. 'unknown' means completion is unconfirmed;
// removal can also have an uncertain admission or final receipt, without a known provider effect.
export type ChangeOutcome = ChangeResult | 'failed' | 'unknown' | 'last-admin' | 'busy' | 'unavailable';

// The provider write started, but its result is not confirmed. A caller can offer a current read, not a blind retry.
export class UnconfirmedChangeError extends Error {
  constructor(cause: unknown) {
    super('The outcome of the organization change is unconfirmed.', { cause });
    this.name = 'UnconfirmedChangeError';
  }
}

type ChangeTarget = { readonly membershipId: string } | { readonly invitationId: string } | { readonly email: string };

// A basic record of a privileged change. It holds no credential.
export interface ChangeRecord {
  // The time of the outcome, in ISO 8601 UTC.
  readonly time: string;
  readonly actor: { readonly authority: string; readonly subject: string };
  readonly organizationId: string;
  readonly target: ChangeTarget;
  // 'invite', 'resend-invitation', 'revoke-invitation', or 'remove-member'. The opt-in sign-in policy uses
  // 'automatic-enrollment' for a new User membership.
  readonly action: string;
  readonly role?: string;
  readonly outcome: ChangeOutcome;
}

export interface ChangeRecorder {
  record(entry: ChangeRecord): void;
}

export type DirectoryChange = () => Promise<ChangeResult>;

export interface ChangeEntry {
  readonly actor: AuthenticatedUser;
  readonly organizationId: string;
  readonly target: ChangeTarget;
  readonly action: string;
  role?: string;
}

// Runs each privileged change in two steps, its checks with current reads and then its one directory change, and
// keeps one record of the outcome. A failure in the checks changed nothing ('failed'); a failure in the directory
// change leaves its effect unknown ('unknown'). It never repeats a directory change.
export class ChangeRecording {
  private readonly records: ChangeRecorder;
  private readonly clock: () => Date;

  constructor(records: ChangeRecorder, clock: () => Date) {
    this.records = records;
    this.clock = clock;
  }

  async run(entry: ChangeEntry, check: () => Promise<ChangeResult | DirectoryChange>): Promise<ChangeResult> {
    const checked = await this.recordingFailure(entry, 'failed', check);
    const outcome = typeof checked === 'string' ? checked : await this.recordingFailure(entry, 'unknown', checked);
    this.record(entry, outcome);
    return outcome;
  }

  private async recordingFailure<T>(entry: ChangeEntry, outcome: 'failed' | 'unknown', work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (cause) {
      this.record(entry, outcome);
      throw outcome === 'unknown' ? new UnconfirmedChangeError(cause) : cause;
    }
  }

  // The record holds only these fields, so that no credential of the session or of an invitation reaches it.
  record(entry: ChangeEntry, outcome: ChangeOutcome): void {
    const { actor, organizationId, target, action, role } = entry;
    try {
      this.records.record(Object.freeze({
        time: this.clock().toISOString(),
        actor: Object.freeze({ authority: actor.authority, subject: actor.subject }),
        organizationId,
        target: Object.freeze({ ...target }),
        action,
        ...(role === undefined ? {} : { role }),
        outcome,
      }));
    } catch {
      // Recording cannot change the outcome or cause a completed directory write to be repeated.
    }
  }
}
