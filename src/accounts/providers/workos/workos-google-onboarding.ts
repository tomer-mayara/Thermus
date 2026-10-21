import type { CreateOrganizationMembershipOptions, ListOrganizationMembershipsOptions, OrganizationMembership } from '@workos-inc/node';
import type { Billing } from '../../billing/billing.ts';
import { activeUserSeatCount } from '../../organizations/administration-overviews.ts';
import { ChangeRecording, type ChangeRecorder } from '../../organizations/change-records.ts';
import type { OrganizationDirectory } from '../../organizations/organization-directory.ts';
import { sealedSessionOf, type CodeExchange, type WorkOSSessionClient } from './workos-session-client.ts';
import type { SignInOnboarding } from './workos-sign-in.ts';

export interface GoogleOnboardingSettings {
  readonly organizationId: string;
}

interface EnrollmentClient extends WorkOSSessionClient {
  readonly userManagement: WorkOSSessionClient['userManagement'] & {
    listOrganizationMemberships(options: ListOrganizationMembershipsOptions): Promise<{ data: readonly OrganizationMembership[]; listMetadata: { after?: string | null } }>;
    createOrganizationMembership(options: CreateOrganizationMembershipOptions): Promise<OrganizationMembership>;
  };
}

interface OnboardingOptions extends GoogleOnboardingSettings {
  readonly authority: string;
  readonly workos: EnrollmentClient;
  readonly settings: { readonly cookiePassword: string };
  readonly records: ChangeRecorder;
  readonly billing: Billing;
  readonly directory: OrganizationDirectory;
}

// Opt-in enrollment for the work slice. Existing memberships retain their status and roles. The per-user queue covers
// callbacks in this instance only: WorkOS create has no absence precondition and can reactivate an inactive record.
// An external writer can race the read. Permanent deletion permits a new enrollment; there is no durable deny list.
export class WorkOSGoogleOnboarding implements SignInOnboarding {
  private readonly options: OnboardingOptions;
  private readonly recording: ChangeRecording;
  private readonly pending = new Map<string, Promise<void>>();
  private readonly uncertain = new Set<string>();

  constructor(options: OnboardingOptions) {
    if (!options.organizationId.trim()) throw new Error('Google onboarding needs an organization ID');
    this.options = options;
    this.recording = new ChangeRecording(options.records, () => new Date());
  }

  complete(exchange: CodeExchange): Promise<CodeExchange> {
    if (!eligible(exchange)) return Promise.resolve(exchange);
    const key = exchange.user.id;
    const previous = this.pending.get(key) ?? Promise.resolve();
    const result = previous.then(() => this.enroll(exchange));
    const settled = result.then(() => {}, () => {});
    this.pending.set(key, settled);
    void settled.then(() => { if (this.pending.get(key) === settled) this.pending.delete(key); });
    return result;
  }

  private async enroll(exchange: CodeExchange): Promise<CodeExchange> {
    const { organizationId, authority } = this.options;
    let outcome;
    try {
      outcome = await this.recording.run({ actor: { authority, subject: exchange.user.id }, organizationId,
        target: { email: exchange.user.email }, action: 'automatic-enrollment', role: 'user' }, async () => {
        const existing = await this.membershipOf(exchange.user.id);
        if (existing !== undefined) {
          this.uncertain.delete(exchange.user.id);
          return activeUser(existing) ? 'unchanged' : 'denied';
        }
        if (this.uncertain.has(exchange.user.id)) throw new Error('The earlier WorkOS enrollment effect is not known; no create was repeated');
        return async () => {
          this.uncertain.add(exchange.user.id);
          const created = await this.options.workos.userManagement.createOrganizationMembership({ organizationId, userId: exchange.user.id, roleSlug: 'user' });
          this.checkMembership(created, exchange.user.id);
          if (!activeUser(created)) throw new Error('WorkOS did not return the requested active User membership');
          this.uncertain.delete(exchange.user.id);
          return 'applied';
        };
      });
    } catch (cause) {
      // A create can succeed before its answer fails. Reconcile once by read, never by a second create.
      if (!this.uncertain.has(exchange.user.id)) throw cause;
      const found = await this.membershipOf(exchange.user.id);
      if (found === undefined) throw cause;
      this.uncertain.delete(exchange.user.id);
      if (!activeUser(found)) throw cause;
      outcome = 'applied';
    }
    if (outcome === 'denied') return exchange;
    if (outcome === 'applied') await this.options.billing.updateSeats(organizationId, await activeUserSeatCount(this.options.directory, organizationId));
    return this.organizationSession(exchange);
  }

  private async membershipOf(userId: string): Promise<OrganizationMembership | undefined> {
    const page = await this.options.workos.userManagement.listOrganizationMemberships({ userId, organizationId: this.options.organizationId,
      statuses: ['active', 'pending', 'inactive'], limit: 2 });
    if (page.data.length > 1 || page.listMetadata.after) throw new Error('WorkOS returned more than one membership for one user and organization');
    const [membership] = page.data;
    if (membership !== undefined) this.checkMembership(membership, userId);
    return membership;
  }

  private checkMembership(membership: OrganizationMembership, userId: string): void {
    if (membership.userId !== userId || membership.organizationId !== this.options.organizationId
      || !['active', 'pending', 'inactive'].includes(membership.status) || !Array.isArray(membership.roles)) {
      throw new Error('WorkOS returned an enrollment membership outside the requested contract');
    }
  }

  private async organizationSession(exchange: CodeExchange): Promise<CodeExchange> {
    const { workos, settings, organizationId } = this.options;
    const session = workos.userManagement.loadSealedSession({ sessionData: sealedSessionOf(exchange), cookiePassword: settings.cookiePassword });
    const refresh = await session.refresh({ organizationId });
    if (!refresh.authenticated) throw new Error('The WorkOS onboarding session refresh failed', { cause: refresh.error });
    if (refresh.organizationId !== organizationId || refresh.user.id !== exchange.user.id) throw new Error('WorkOS refreshed onboarding into another user or organization');
    return { ...exchange, organizationId, sealedSession: sealedSessionOf(refresh) };
  }
}

function activeUser(membership: OrganizationMembership): boolean {
  return membership.status === 'active' && membership.roles?.some(({ slug }) => slug === 'user') === true;
}

function eligible(exchange: CodeExchange): boolean {
  const address = exchange.user.email.trim().toLowerCase();
  const parts = address.split('@');
  return exchange.authenticationMethod === 'GoogleOAuth' && exchange.user.emailVerified === true
    && parts.length === 2 && parts[0] !== '' && parts[1] === 'thermus.ai';
}
