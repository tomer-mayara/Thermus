import type { AuthenticatedUser } from '../auth/access-context.ts';

// 'unchanged': the membership already had the requested grants, so no change was necessary. 'address-in-use': the
// directory sent no invitation, because the address belongs to a member or has a pending invitation.
export type ChangeResult = 'applied' | 'unchanged' | 'denied' | 'mfa-required' | 'stale' | 'not-pending' | 'address-in-use' | 'unsupported';

// A record also keeps the outcome of a change that failed: 'failed' before the directory change started, so that
// nothing changed, and 'unknown' during the directory change, so that its effect is not known.
export type ChangeOutcome = ChangeResult | 'failed' | 'unknown';

type ChangeTarget = { readonly membershipId: string } | { readonly invitationId: string } | { readonly email: string };

// A basic record of a privileged change. It holds no credential.
export interface ChangeRecord {
  // The time of the outcome, in ISO 8601 UTC.
  readonly time: string;
  readonly actor: { readonly authority: string; readonly subject: string };
  readonly organizationId: string;
  readonly target: ChangeTarget;
  // 'invite', 'resend-invitation', 'revoke-invitation', or the action of a grant change as requested: 'grant',
  // 'revoke'. The opt-in sign-in policy uses 'automatic-enrollment' for a new User membership.
  readonly action: string;
  readonly role?: string;
  readonly outcome: ChangeOutcome;
}

export interface ChangeRecorder {
  record(entry: ChangeRecord): void;
}

// The rest of a change after its checks: its one directory change, which gives the result.
export type DirectoryChange = () => Promise<ChangeResult>;

// The record of a change in progress. The role of an invitation change is known after the invitation is read.
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
    this.keep(entry, outcome);
    return outcome;
  }

  private async recordingFailure<T>(entry: ChangeEntry, outcome: 'failed' | 'unknown', work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (cause) {
      this.keep(entry, outcome);
      throw cause;
    }
  }

  // The record holds only these fields, so that no credential of the session or of an invitation reaches it.
  private keep(entry: ChangeEntry, outcome: ChangeOutcome): void {
    const { actor, organizationId, target, action, role } = entry;
    this.records.record(Object.freeze({
      time: this.clock().toISOString(),
      actor: Object.freeze({ authority: actor.authority, subject: actor.subject }),
      organizationId,
      target: Object.freeze({ ...target }),
      action,
      ...(role === undefined ? {} : { role }),
      outcome,
    }));
  }
}
