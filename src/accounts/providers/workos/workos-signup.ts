import { createHash } from 'node:crypto';
import type { CreateOrganizationOptions, CreateOrganizationMembershipOptions, ListOrganizationMembershipsOptions } from '@workos-inc/node';
import type { AuthenticatedUser } from '../../identity/access-context.ts';
import type { OrganizationDirectory } from '../../organizations/organization-directory.ts';
import { organizationNameIn, type SignupActivation, type SignupDocuments, type SignupResult, type SignupState } from '../../organizations/signup-activation.ts';
import { grantsOfRoles, type RoleRecord } from './hosted-role-mapping.ts';
import { validateSignupDocuments } from './workos-signup-documents.ts';

type InspectionRequest = Parameters<SignupActivation['inspect']>[0];
type ActivationRequest = Parameters<SignupActivation['activate']>[0];

interface SignupOrganization {
  readonly id: string;
  readonly name: string;
  readonly externalId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
  readonly domains: readonly unknown[];
}

interface Creation {
  readonly name: string;
  readonly metadata: Readonly<Record<string, string>>;
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
      getOrganizationByExternalId(externalId: string): Promise<SignupOrganization>;
      getOrganization(id: string): Promise<SignupOrganization>;
      createOrganization(options: CreateOrganizationOptions): Promise<SignupOrganization>;
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

const SCHEMA = 'thermus-signup-v2';
const LEGACY_SCHEMA = 'thermus-signup-v1';
const SUPPORT = Object.freeze({ status: 'support-required' as const });
const UNAVAILABLE = Object.freeze({ status: 'unavailable' as const });
const RECORD_KEYS = ['schema', 'subject', 'authority_accepted_at', 'documents_version', 'terms_version', 'terms_sha256', 'notice_version', 'notice_sha256', 'agreement_version', 'agreement_sha256'];
const LEGACY_RECORD_KEYS = ['schema', 'subject', 'accepted_at', 'documents_version', 'terms_version', 'terms_sha256', 'notice_version', 'notice_sha256', 'agreement_version'];

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
    return this.createOrganization(request);
  }

  private async hasProductAccess({ user, signal }: InspectionRequest, excludedOrganizationId?: string): Promise<boolean> {
    signal.throwIfAborted();
    const memberships = await this.options.directory.membershipsOf(user);
    signal.throwIfAborted();
    return memberships.some((membership) => membership.organizationId !== excludedOrganizationId && membership.active
      && membership.grants.some((grant) => grant.permissions.includes('product:access')));
  }

  private async createOrganization(request: ActivationRequest): Promise<SignupResult> {
    const { user, signal } = request;
    const creation = creationOf(request, this.options.clock ?? (() => new Date()));
    if (creation === undefined) return UNAVAILABLE;
    signal.throwIfAborted();
    let created: SignupOrganization;
    try {
      created = await this.options.workos.organizations.createOrganization({ name: creation.name, externalId: personalExternalId(user), metadata: creation.metadata });
    } catch {
      // A lost response and a conflict confer no grant authority, even when the saved record can be read.
      signal.throwIfAborted();
      return this.recoverAccess(request);
    }
    signal.throwIfAborted();
    if (!isRequestedRecord(created, user, creation)) return SUPPORT;
    const saved = await this.options.workos.organizations.getOrganization(created.id);
    signal.throwIfAborted();
    if (!isRequestedRecord(saved, user, creation) || saved.id !== created.id) return SUPPORT;
    return this.grantNewWorkspace(saved, request);
  }

  private async grantNewWorkspace(organization: SignupOrganization, request: ActivationRequest): Promise<SignupResult> {
    const { user, signal } = request;
    const roles = (await this.options.workos.authorization.listOrganizationRoles(organization.id)).data;
    signal.throwIfAborted();
    grantsOfRoles([{ slug: 'admin' }], roles, organization.id);
    if ((await this.memberships(organization.id, signal)).length !== 0) return SUPPORT;
    signal.throwIfAborted();
    try {
      const created = await this.options.workos.userManagement.createOrganizationMembership({ organizationId: organization.id, userId: user.subject, roleSlug: 'admin' });
      if (!usableMembership(created, true) || created.userId !== user.subject || created.organizationId !== organization.id) return SUPPORT;
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

  private async findOrganization(externalId: string): Promise<SignupOrganization | undefined> {
    try {
      return await this.options.workos.organizations.getOrganizationByExternalId(externalId);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) return undefined;
      throw error;
    }
  }

  private async savedAccess(organization: SignupOrganization, request: InspectionRequest, requireAdminOnly = false): Promise<SignupResult> {
    const { user, signal } = request;
    if (!validRecord(organization, user)) return SUPPORT;
    const records = await this.memberships(organization.id, signal);
    const own = records.filter((record) => record.userId === user.subject);
    if (own.length !== 1) return SUPPORT;
    const [membership] = own;
    if (!usableMembership(membership, requireAdminOnly)) return SUPPORT;
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

function creationOf(request: ActivationRequest, clock: () => Date): Creation | undefined {
  const name = organizationNameIn(request.organizationName);
  if (name === undefined || request.documents.purpose !== 'organization-creation') return undefined;
  const metadata = acceptanceRecord(request.user.subject, validateSignupDocuments(request.documents), clock());
  return validAcceptance(metadata, request.user.subject) ? { name, metadata } : undefined;
}

function isRequestedRecord(organization: SignupOrganization, user: AuthenticatedUser, creation: Creation): boolean {
  return validRecord(organization, user) && organization.name === creation.name && sameRecord(organization.metadata, creation.metadata);
}

function acceptanceRecord(subject: string, documents: SignupDocuments, now: Date): Record<string, string> {
  return { schema: SCHEMA, subject, authority_accepted_at: now.toISOString(), documents_version: documents.version,
    terms_version: documents.terms.version, terms_sha256: documents.terms.sha256, notice_version: documents.notice.version,
    notice_sha256: documents.notice.sha256, agreement_version: documents.agreement.version,
    agreement_sha256: createHash('sha256').update(documents.agreement.text, 'utf8').digest('hex') };
}

function personalExternalId(user: AuthenticatedUser): string {
  return `thermus-signup:${createHash('sha256').update(user.authority).update('\0').update(user.subject).digest('base64url')}`;
}

function usableMembership(membership: Membership, requireAdminOnly: boolean): membership is Membership & { readonly roles: readonly { readonly slug: string }[] } {
  if (typeof membership !== 'object' || membership === null || membership.status !== 'active'
    || membership.directoryManaged !== false || !Array.isArray(membership.roles)) return false;
  return !requireAdminOnly || (membership.roles.length === 1 && membership.roles[0]?.slug === 'admin');
}

function validRecord(organization: SignupOrganization, user: AuthenticatedUser): boolean {
  return typeof organization === 'object' && organization !== null && typeof organization.id === 'string' && organization.id !== '' && organization.externalId === personalExternalId(user)
    && Array.isArray(organization.domains) && organization.domains.length === 0 && validAcceptance(organization.metadata, user.subject);
}

function validAcceptance(record: Readonly<Record<string, string>>, subject: string): boolean {
  if (!validAcceptanceFields(record)) return false;
  const acceptedAt = record.schema === SCHEMA ? record.authority_accepted_at : record.accepted_at;
  return record.subject === subject && validAcceptanceTime(acceptedAt)
    && /^[a-f0-9]{64}$/.test(record.terms_sha256) && /^[a-f0-9]{64}$/.test(record.notice_sha256)
    && (record.schema === LEGACY_SCHEMA || /^[a-f0-9]{64}$/.test(record.agreement_sha256));
}

function validAcceptanceFields(record: Readonly<Record<string, string>>): boolean {
  if (typeof record !== 'object' || record === null) return false;
  const keys = record.schema === SCHEMA ? RECORD_KEYS : record.schema === LEGACY_SCHEMA ? LEGACY_RECORD_KEYS : undefined;
  return keys !== undefined && Object.keys(record).length === keys.length
    && keys.every((key) => typeof record[key] === 'string' && /^[\x00-\x7f]{1,500}$/.test(record[key]));
}

function validAcceptanceTime(time: string): boolean {
  return Number.isFinite(Date.parse(time)) && new Date(time).toISOString() === time;
}

function sameRecord(actual: Readonly<Record<string, string>>, expected: Readonly<Record<string, string>>): boolean {
  return RECORD_KEYS.every((key) => actual[key] === expected[key]);
}
