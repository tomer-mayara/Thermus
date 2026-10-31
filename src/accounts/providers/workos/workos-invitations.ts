import type { ListInvitationsOptions, SendInvitationOptions } from '@workos-inc/node';
import type {
  InvitationPageRequest,
  InvitationRequest,
  InvitationSendResult,
  InvitationState,
  InvitationUpdateResult,
  OrganizationDirectory,
  OrganizationInvitation,
  Page,
} from '../../organizations/organization-directory.ts';
import { afterOf, hasCode, hasStatus, PAGE_SIZE, pageOf, unlessNotFound, type WorkOSList } from './workos-answers.ts';

// WorkOS also gives the token and the link of an invitation. They are credentials of the invited person, so the
// directory never copies them.
export interface InvitationRecord {
  readonly id: string;
  readonly email: string;
  readonly state: InvitationState;
  readonly expiresAt: string;
  // Null for an invitation to the application, not to an organization.
  readonly organizationId: string | null;
  readonly roleSlug: string | null;
}

export interface InvitationCalls {
  listInvitations(options: ListInvitationsOptions): Promise<WorkOSList<InvitationRecord>>;
  getInvitation(invitationId: string): Promise<InvitationRecord>;
  sendInvitation(options: SendInvitationOptions): Promise<InvitationRecord>;
  resendInvitation(invitationId: string): Promise<InvitationRecord>;
  revokeInvitation(invitationId: string): Promise<InvitationRecord>;
}

const APPLIED = Object.freeze({ outcome: 'applied' as const });
const ADDRESS_IN_USE = Object.freeze({ outcome: 'address-in-use' as const });
const NOT_PENDING = Object.freeze({ outcome: 'not-pending' as const });
// WorkOS refuses a send to an address that has a pending invitation of the organization, for any role and in any
// letter case, and a send to the address of an active member, each with 400 and one of these codes.
const ADDRESS_IN_USE_CODES: ReadonlySet<unknown> = new Set(['email_already_invited_to_organization', 'user_already_organization_member']);

export class WorkOSInvitations implements Pick<OrganizationDirectory, 'invitationPage' | 'invitation' | 'sendInvitation' | 'resendInvitation' | 'revokeInvitation'> {
  private readonly userManagement: InvitationCalls;
  private readonly clock: () => Date;

  constructor(userManagement: InvitationCalls, clock: () => Date) {
    this.userManagement = userManagement;
    this.clock = clock;
  }

  // WorkOS has no state filter for invitations, so the read keeps only the states that it names.
  async invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>> {
    const { organizationId, states, cursor } = request;
    if (states.length === 0) throw new Error('An invitation read must name at least one invitation state');
    const page = await this.userManagement.listInvitations({ organizationId, limit: PAGE_SIZE, ...afterOf(cursor) });
    const now = this.clock();
    const invitations: OrganizationInvitation[] = [];
    for (const record of page.data) {
      if (record.organizationId !== organizationId) throw new Error('WorkOS answered an invitation that the read did not ask for');
      const state = invitationStateOf(record, now);
      if (states.includes(state)) invitations.push(invitationOf(record, organizationId, state));
    }
    return pageOf(invitations, page.listMetadata.after);
  }

  // An invitation without an organization is not an organization invitation, so it gives undefined.
  async invitation(invitationId: string): Promise<OrganizationInvitation | undefined> {
    const record = await this.currentInvitation(invitationId);
    if (record?.organizationId == null) return undefined;
    return invitationOf(record, record.organizationId, invitationStateOf(record, this.clock()));
  }

  // When WorkOS answers, the send happened. Thus an answer that is not the invitation of the request throws, because the
  // effect of the send is not known.
  async sendInvitation(request: InvitationRequest): Promise<InvitationSendResult> {
    const { organizationId, email, role } = request;
    let sent: InvitationRecord;
    try {
      sent = await this.userManagement.sendInvitation({ email, organizationId, roleSlug: role });
    } catch (error) {
      if (hasStatus(error, 400) && hasCode(error, ADDRESS_IN_USE_CODES)) return ADDRESS_IN_USE;
      throw error;
    }
    if (!isInvitationOf(sent, request)) throw new Error('WorkOS answered the send with an invitation that the send did not ask for');
    return APPLIED;
  }

  async resendInvitation(invitationId: string): Promise<InvitationUpdateResult> {
    return this.changeInvitation(invitationId, 'pending', () => this.userManagement.resendInvitation(invitationId));
  }

  async revokeInvitation(invitationId: string): Promise<InvitationUpdateResult> {
    return this.changeInvitation(invitationId, 'revoked', () => this.userManagement.revokeInvitation(invitationId));
  }

  // WorkOS refuses a change of an invitation that is not pending with 400, but 400 can have other causes. Thus a read of
  // the invitation decides: only an invitation that exists and is no longer pending gives not-pending. The answer of a
  // change must be the invitation in the state after the change, else the effect of the change is not known.
  private async changeInvitation(invitationId: string, stateAfter: InvitationState, change: () => Promise<InvitationRecord>): Promise<InvitationUpdateResult> {
    let changed: InvitationRecord;
    try {
      changed = await change();
    } catch (error) {
      if (hasStatus(error, 400) && await this.isNoLongerPending(invitationId)) return NOT_PENDING;
      throw error;
    }
    if (changed.id !== invitationId || changed.state !== stateAfter) throw new Error('WorkOS answered the change with an invitation that the change did not ask for');
    return APPLIED;
  }

  private async isNoLongerPending(invitationId: string): Promise<boolean> {
    const record = await this.currentInvitation(invitationId);
    return record !== undefined && invitationStateOf(record, this.clock()) !== 'pending';
  }

  private async currentInvitation(invitationId: string): Promise<InvitationRecord | undefined> {
    const record = await unlessNotFound(() => this.userManagement.getInvitation(invitationId));
    if (record !== undefined && record.id !== invitationId) throw new Error('WorkOS answered an invitation that the read did not ask for');
    return record;
  }
}

// WorkOS can still give the state pending after the expiry time, so the clock decides.
function invitationStateOf(record: InvitationRecord, now: Date): InvitationState {
  if (record.state !== 'pending') return record.state;
  const expiresAt = Date.parse(record.expiresAt);
  if (Number.isNaN(expiresAt)) throw new Error('WorkOS answered a pending invitation without a valid expiry time');
  return expiresAt <= now.getTime() ? 'expired' : 'pending';
}

// WorkOS gives the current role of the membership of an invitation. Thus only the role of a pending invitation is the
// role that its acceptance gives.
function invitationOf(record: InvitationRecord, organizationId: string, state: InvitationState): OrganizationInvitation {
  const role = record.roleSlug;
  if (!role) throw new Error('WorkOS answered an organization invitation without a role');
  return Object.freeze({ invitationId: record.id, organizationId, email: record.email, role, state, expiresAt: record.expiresAt });
}

// WorkOS compares addresses without letter case.
function isInvitationOf(record: InvitationRecord, request: InvitationRequest): boolean {
  return record.state === 'pending' && record.organizationId === request.organizationId && record.roleSlug === request.role
    && record.email.toLowerCase() === request.email.toLowerCase();
}
