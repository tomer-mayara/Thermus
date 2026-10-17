import { createHash } from 'node:crypto';
import type { CreateOrganizationOptions, CreateOrganizationMembershipOptions, ListOrganizationMembershipsOptions } from '@workos-inc/node';
import type { AuthenticatedUser } from '../../access-context.ts';
import type { OrganizationDirectory } from '../../../organizations/organization-directory.ts';
import { grantsOfRoles, type RoleRecord } from './hosted-role-mapping.ts';

export interface SignupDocuments {
  readonly version: string;
  readonly terms: { readonly version: string; readonly sha256: string; readonly text: string };
  readonly notice: { readonly version: string; readonly sha256: string; readonly text: string };
  readonly agreement: { readonly version: string; readonly text: string };
}

export type SignupResult =
  | { readonly status: 'active'; readonly organizationId: string }
  | { readonly status: 'existing-access' | 'unverified' | 'support-required' | 'unavailable' | 'sign-in-required' };

export type SignupState =
  | { readonly status: 'eligible' | 'existing-access' | 'unavailable' | 'sign-in-required' }
  | { readonly status: 'support-required'; readonly canContinue: boolean };

export interface SignupActivation {
  inspect(request: { readonly user: AuthenticatedUser; readonly signal: AbortSignal }): Promise<SignupState>;
  activate(request: { readonly user: AuthenticatedUser; readonly documents: SignupDocuments; readonly signal: AbortSignal }): Promise<SignupResult>;
}

type InspectionRequest = Parameters<SignupActivation['inspect']>[0];
type ActivationRequest = Parameters<SignupActivation['activate']>[0];

interface PersonalOrganization {
  readonly id: string;
  readonly externalId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
  readonly domains: readonly unknown[];
}

interface Membership {
  readonly userId: string;
  readonly organizationId: string;
  readonly status: string;
  readonly directoryManaged: boolean;
  readonly roles?: readonly { readonly slug: string }[];
}

export interface WorkOSSignupOptions {
  readonly authority: string;
  readonly workos: {
    readonly organizations: {
      getOrganizationByExternalId(externalId: string): Promise<PersonalOrganization>;
      getOrganization(id: string): Promise<PersonalOrganization>;
      createOrganization(options: CreateOrganizationOptions): Promise<PersonalOrganization>;
    };
    readonly userManagement: {
      getUser(userId: string): Promise<{ readonly id: string; readonly emailVerified: boolean }>;
      listOrganizationMemberships(options: ListOrganizationMembershipsOptions): Promise<{ readonly data: readonly Membership[]; readonly listMetadata: { readonly after?: string | null } }>;
      createOrganizationMembership(options: CreateOrganizationMembershipOptions): Promise<Membership>;
    };
    readonly authorization: {
      listOrganizationRoles(organizationId: string): Promise<{ readonly data: readonly RoleRecord[] }>;
    };
  };
  readonly directory: Pick<OrganizationDirectory, 'membershipsOf'>;
  readonly clock?: () => Date;
}

const SCHEMA = 'thermus-signup-v1';
const SUPPORT = Object.freeze({ status: 'support-required' as const });
const UNAVAILABLE = Object.freeze({ status: 'unavailable' as const });
const RECORD_KEYS = ['schema', 'subject', 'accepted_at', 'documents_version', 'terms_version', 'terms_sha256', 'notice_version', 'notice_sha256', 'agreement_version'];

// The retained external ID makes only a confirmed new-create response a grant authority. An uncertain write or a
// later request can read access, but cannot create or restore a membership. The client must have retries disabled.
export class WorkOSSignup implements SignupActivation {
  constructor(private readonly options: WorkOSSignupOptions) {}

  async inspect(request: InspectionRequest): Promise<SignupState> {
    try {
      const { user, signal } = request;
      if (user.authority !== this.options.authority || !user.subject || signal.aborted) return UNAVAILABLE;
      const current = await this.currentUser(user.subject);
      signal.throwIfAborted();
      if (current === undefined) return { status: 'sign-in-required' };
      if (current.id !== user.subject) return UNAVAILABLE;
      const existing = await this.findOrganization(personalExternalId(user));
      signal.throwIfAborted();
      if (existing !== undefined) {
        const access = await this.savedAccess(existing, request);
        if (access.status === 'active') return { status: 'existing-access' };
        return { status: 'support-required', canContinue: await this.hasProductAccess(request, existing.id) };
      }
      return { status: await this.hasProductAccess(request) ? 'existing-access' : 'eligible' };
    } catch {
      return UNAVAILABLE;
    }
  }

  async activate(request: ActivationRequest): Promise<SignupResult> {
    try {
      const { user, signal } = request;
      if (user.authority !== this.options.authority || !user.subject || signal.aborted) return UNAVAILABLE;
      const current = await this.currentUser(user.subject);
      signal.throwIfAborted();
      if (current === undefined) return { status: 'sign-in-required' };
      if (current.id !== user.subject) return UNAVAILABLE;
      if (current.emailVerified !== true) return { status: 'unverified' };
      return await this.chooseWorkspace(request);
    } catch {
      return UNAVAILABLE;
    }
  }

  private async currentUser(subject: string): Promise<{ readonly id: string; readonly emailVerified: boolean } | undefined> {
    try {
      return await this.options.workos.userManagement.getUser(subject);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) return undefined;
      throw error;
    }
  }

  private async chooseWorkspace(request: ActivationRequest): Promise<SignupResult> {
    const { user, signal } = request;
    const existing = await this.findOrganization(personalExternalId(user));
    signal.throwIfAborted();
    if (existing !== undefined) return this.savedAccess(existing, request);
    if (await this.hasProductAccess(request)) return { status: 'existing-access' };
    return this.createPersonalWorkspace(request);
  }

  private async hasProductAccess({ user, signal }: InspectionRequest, excludedOrganizationId?: string): Promise<boolean> {
    signal.throwIfAborted();
    const memberships = await this.options.directory.membershipsOf(user);
    signal.throwIfAborted();
    return memberships.some((membership) => membership.organizationId !== excludedOrganizationId && membership.active
      && membership.grants.some((grant) => grant.permissions.includes('product:access')));
  }

  private async createPersonalWorkspace(request: ActivationRequest): Promise<SignupResult> {
    const { user, documents, signal } = request;
    const metadata = acceptanceRecord(user.subject, documents, (this.options.clock ?? (() => new Date()))());
    signal.throwIfAborted();
    let created: PersonalOrganization;
    try {
      created = await this.options.workos.organizations.createOrganization({ name: 'Personal workspace', externalId: personalExternalId(user), metadata });
    } catch {
      // A lost response and a conflict confer no grant authority, even when the saved record can be read.
      signal.throwIfAborted();
      return this.recoverAccess(request);
    }
    signal.throwIfAborted();
    if (!validRecord(created, user) || !sameRecord(created.metadata, metadata)) return SUPPORT;
    const saved = await this.options.workos.organizations.getOrganization(created.id);
    signal.throwIfAborted();
    if (saved.id !== created.id || !validRecord(saved, user) || !sameRecord(saved.metadata, metadata)) return SUPPORT;
    return this.grantNewWorkspace(saved, request);
  }

  private async grantNewWorkspace(organization: PersonalOrganization, request: ActivationRequest): Promise<SignupResult> {
    const { user, signal } = request;
    const roles = (await this.options.workos.authorization.listOrganizationRoles(organization.id)).data;
    signal.throwIfAborted();
    grantsOfRoles([{ slug: 'user' }, { slug: 'member' }], roles, organization.id);
    if ((await this.memberships(organization.id, signal)).length !== 0) return SUPPORT;
    signal.throwIfAborted();
    try {
      await this.options.workos.userManagement.createOrganizationMembership({ organizationId: organization.id, userId: user.subject, roleSlug: 'user' });
    } catch {
      // Read once after an uncertain write. Never repeat it, including after a restart.
    }
    signal.throwIfAborted();
    return this.savedAccess(organization, request, true);
  }

  private async recoverAccess(request: ActivationRequest): Promise<SignupResult> {
    const saved = await this.findOrganization(personalExternalId(request.user));
    request.signal.throwIfAborted();
    return saved === undefined ? UNAVAILABLE : this.savedAccess(saved, request);
  }

  private async findOrganization(externalId: string): Promise<PersonalOrganization | undefined> {
    try {
      return await this.options.workos.organizations.getOrganizationByExternalId(externalId);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) return undefined;
      throw error;
    }
  }

  private async savedAccess(organization: PersonalOrganization, request: InspectionRequest, requireUserOnly = false): Promise<SignupResult> {
    const { user, signal } = request;
    if (!validRecord(organization, user)) return SUPPORT;
    const records = await this.memberships(organization.id, signal);
    const own = records.filter((record) => record.userId === user.subject);
    if (own.length !== 1) return SUPPORT;
    const [membership] = own;
    if (!usableMembership(membership, requireUserOnly)) return SUPPORT;
    const roles = (await this.options.workos.authorization.listOrganizationRoles(organization.id)).data;
    signal.throwIfAborted();
    const grants = grantsOfRoles(membership.roles, roles, organization.id);
    return grants.some((grant) => grant.permissions.includes('product:access')) ? { status: 'active', organizationId: organization.id } : SUPPORT;
  }

  private async memberships(organizationId: string, signal: AbortSignal): Promise<readonly Membership[]> {
    const records: Membership[] = [];
    let after: string | undefined;
    const cursors = new Set<string>();
    for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
      const page = await this.options.workos.userManagement.listOrganizationMemberships({ organizationId, statuses: ['active', 'pending', 'inactive'], limit: 100, ...(after === undefined ? {} : { after }) });
      signal.throwIfAborted();
      if (page.data.length > 100 || page.data.some((record) => record.organizationId !== organizationId || !record.userId || !['active', 'pending', 'inactive'].includes(record.status) || typeof record.directoryManaged !== 'boolean')) {
        throw new Error('Invalid signup membership response');
      }
      records.push(...page.data);
      after = page.listMetadata.after ?? undefined;
      if (after === undefined || after === '') return records;
      if (cursors.has(after)) throw new Error('Repeated signup membership cursor');
      cursors.add(after);
    }
    throw new Error('Signup membership read limit exceeded');
  }
}

function acceptanceRecord(subject: string, documents: SignupDocuments, now: Date): Record<string, string> {
  return { schema: SCHEMA, subject, accepted_at: now.toISOString(), documents_version: documents.version,
    terms_version: documents.terms.version, terms_sha256: documents.terms.sha256, notice_version: documents.notice.version,
    notice_sha256: documents.notice.sha256, agreement_version: documents.agreement.version };
}

function personalExternalId(user: AuthenticatedUser): string {
  return `thermus-signup:${createHash('sha256').update(user.authority).update('\0').update(user.subject).digest('base64url')}`;
}

function usableMembership(membership: Membership, requireUserOnly: boolean): membership is Membership & { readonly roles: readonly { readonly slug: string }[] } {
  if (membership.status !== 'active' || membership.directoryManaged || !Array.isArray(membership.roles)) return false;
  return !requireUserOnly || (membership.roles.length === 1 && membership.roles[0].slug === 'user');
}

function validRecord(organization: PersonalOrganization, user: AuthenticatedUser): boolean {
  return typeof organization.id === 'string' && organization.id !== '' && organization.externalId === personalExternalId(user)
    && Array.isArray(organization.domains) && organization.domains.length === 0 && validAcceptance(organization.metadata, user.subject);
}

function validAcceptance(record: Readonly<Record<string, string>>, subject: string): boolean {
  return validAcceptanceFields(record) && record.schema === SCHEMA && record.subject === subject
    && validAcceptanceTime(record.accepted_at) && /^[a-f0-9]{64}$/.test(record.terms_sha256) && /^[a-f0-9]{64}$/.test(record.notice_sha256);
}

function validAcceptanceFields(record: Readonly<Record<string, string>>): boolean {
  return typeof record === 'object' && record !== null && Object.keys(record).length === RECORD_KEYS.length
    && RECORD_KEYS.every((key) => typeof record[key] === 'string' && record[key].length > 0 && record[key].length <= 500);
}

function validAcceptanceTime(time: string): boolean {
  return Number.isFinite(Date.parse(time)) && new Date(time).toISOString() === time;
}

function sameRecord(actual: Readonly<Record<string, string>>, expected: Readonly<Record<string, string>>): boolean {
  return RECORD_KEYS.every((key) => actual[key] === expected[key]);
}
