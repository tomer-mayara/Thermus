import type { Organization, OrganizationMembership, User, WorkOS } from '@workos-inc/node';

// The steps of the operator runbook, docs/implementation/hosted-organization-setup.md, with the pinned SDK. The live
// proofs run these steps against the staging environment, so that each rule of the runbook rests on WorkOS behavior.
// They are test support only: the product has no operator method or route.

export type OperatorAction = 'locate-or-create-organization' | 'grant-super-admin' | 'revoke-super-admin' | 'inspect-after-unknown-outcome';
// applied: the change is in WorkOS now. unchanged: no change was necessary. stopped: the runbook needs a decision of
// a person before any write. unknown: the effect of the write is not known, so the next step is an inspection.
export type OperatorOutcome = 'applied' | 'unchanged' | 'stopped' | 'unknown';

// One basic record of an operator step. It holds no credential: no API key, token, password, code, or link.
export interface OperatorRecord {
  readonly time: string;
  readonly actor: string;
  readonly organizationId: string;
  readonly target: { readonly userId?: string; readonly email?: string; readonly externalId?: string };
  readonly action: OperatorAction;
  readonly rolesBefore?: readonly string[];
  readonly rolesAfter?: readonly string[];
  readonly outcome: OperatorOutcome;
  readonly reason?: string;
}

export interface OrganizationRequest {
  // The customer reference of the operator. WorkOS refuses a second organization with it, so no create makes a
  // duplicate.
  readonly externalId: string;
  readonly name: string;
}

export interface SuperAdminRequest {
  readonly organizationId: string;
  readonly email: string;
}

interface MembershipState {
  readonly user: User;
  readonly membership: OrganizationMembership | undefined;
  readonly roles: readonly string[];
}

type RecordFacts = Omit<OperatorRecord, 'time' | 'actor'>;

export const superAdminRole = 'super-admin';
const defaultRole = 'member';

export function rolesOf(membership: OrganizationMembership | undefined): string[] {
  if (membership === undefined) return [];
  return (membership.roles ?? [membership.role]).map(({ slug }) => slug).toSorted();
}

function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
}

function sameRoles(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((role) => actual.includes(role));
}

export class OperatorRunbook {
  readonly records: OperatorRecord[] = [];
  readonly #workos: WorkOS;
  readonly #actor: string;

  // The actor names the operator, for example the WorkOS dashboard account of the person, never a credential.
  constructor(workos: WorkOS, actor: string) {
    this.#workos = workos;
    this.#actor = actor;
  }

  // Step 1: locate the organization by the external ID of the operator, or create it. A located organization must
  // have the expected name; else the runbook stops.
  async organization(request: OrganizationRequest): Promise<Organization> {
    const target = { externalId: request.externalId };
    const found = await this.organizationByExternalId(request.externalId);
    if (found !== undefined) {
      const named = found.name === request.name;
      this.record({ organizationId: found.id, target, action: 'locate-or-create-organization', outcome: named ? 'unchanged' : 'stopped', ...(named ? {} : { reason: 'another organization has this external ID' }) });
      if (!named) throw new Error(`The external ID ${request.externalId} names an organization with another name. Stop and check it.`);
      return found;
    }
    const created = await this.#workos.organizations.createOrganization({ name: request.name, externalId: request.externalId });
    this.record({ organizationId: created.id, target, action: 'locate-or-create-organization', outcome: 'applied' });
    return created;
  }

  async organizationByExternalId(externalId: string): Promise<Organization | undefined> {
    try {
      return await this.#workos.organizations.getOrganizationByExternalId(externalId);
    } catch (error) {
      if (statusOf(error) === 404) return undefined;
      throw error;
    }
  }

  // Step 2: the intended identity is the one WorkOS user with this email, and the email is verified.
  async identity(email: string): Promise<User> {
    const { data } = await this.#workos.userManagement.listUsers({ email, limit: 2 });
    const [user] = data;
    if (data.length !== 1 || user === undefined) throw new Error(`WorkOS has ${data.length} users with the email of the request. Stop and check the identity.`);
    if (!user.emailVerified) throw new Error('The email of the identity is not verified. Stop and check the identity.');
    return user;
  }

  // Step 3: the membership of the identity in the organization, in each status, so that no default filter hides an
  // inactive or pending membership.
  async membership(userId: string, organizationId: string): Promise<OrganizationMembership | undefined> {
    const { data } = await this.#workos.userManagement.listOrganizationMemberships({ userId, organizationId, statuses: ['active', 'inactive', 'pending'], limit: 10 });
    if (data.length > 1) throw new Error('WorkOS has more than one membership of the identity in the organization. Stop and check them.');
    return data[0];
  }

  // Step 4: add only the explicit Super Admin grant. Each other grant stays. An inactive or pending membership stops
  // the runbook: a create would activate it, and a reactivation would restore its earlier roles.
  async grantSuperAdmin(request: SuperAdminRequest): Promise<OperatorRecord> {
    const state = await this.stateOf(request);
    const facts = this.factsOf(request, state, 'grant-super-admin');
    const { membership, roles } = state;
    if (membership === undefined) {
      return this.written(facts, [superAdminRole], () => this.#workos.userManagement.createOrganizationMembership({ organizationId: request.organizationId, userId: state.user.id, roleSlugs: [superAdminRole] }));
    }
    if (membership.status !== 'active') return this.record({ ...facts, outcome: 'stopped', reason: `the membership is ${membership.status}: no create and no reactivation without a decision` });
    if (roles.includes(superAdminRole)) return this.record({ ...facts, rolesAfter: roles, outcome: 'unchanged' });
    const expected = [...roles, superAdminRole];
    return this.written(facts, expected, () => this.#workos.userManagement.updateOrganizationMembership(membership.id, { roleSlugs: expected }));
  }

  // Remove only Super Admin. Each other grant, the identity, and the other memberships stay. Without another role, the
  // membership keeps the default role, which gives no application permission.
  async revokeSuperAdmin(request: SuperAdminRequest): Promise<OperatorRecord> {
    const state = await this.stateOf(request);
    const facts = this.factsOf(request, state, 'revoke-super-admin');
    const { membership, roles } = state;
    if (membership === undefined || !roles.includes(superAdminRole)) return this.record({ ...facts, rolesAfter: roles, outcome: 'unchanged' });
    if (membership.status !== 'active') return this.record({ ...facts, outcome: 'stopped', reason: `the membership is ${membership.status}: no change without a decision` });
    const remaining = roles.filter((role) => role !== superAdminRole);
    const expected = remaining.length === 0 ? [defaultRole] : remaining;
    return this.written(facts, expected, () => this.#workos.userManagement.updateOrganizationMembership(membership.id, { roleSlugs: expected }));
  }

  // After an unknown outcome of a Super Admin grant, the operator inspects and writes nothing. A grant in place needs no
  // second write. An absent grant can be a later removal, so only a new decision can start a new setup.
  async inspectAfterUnknownOutcome(request: SuperAdminRequest): Promise<OperatorRecord> {
    const state = await this.stateOf(request);
    const facts = { ...this.factsOf(request, state, 'inspect-after-unknown-outcome'), rolesAfter: state.roles };
    const { membership, roles } = state;
    if (membership !== undefined && membership.status !== 'active') {
      return this.record({ ...facts, outcome: 'stopped', reason: `the membership is ${membership.status}: no reactivation on a retry` });
    }
    if (roles.includes(superAdminRole)) return this.record({ ...facts, outcome: 'applied', reason: 'the earlier grant is in place' });
    return this.record({ ...facts, outcome: 'stopped', reason: 'the grant is absent: it was not applied, or it was removed later' });
  }

  private async stateOf(request: SuperAdminRequest): Promise<MembershipState> {
    const user = await this.identity(request.email);
    const membership = await this.membership(user.id, request.organizationId);
    return { user, membership, roles: rolesOf(membership) };
  }

  private factsOf(request: SuperAdminRequest, state: MembershipState, action: OperatorAction): RecordFacts {
    return { organizationId: request.organizationId, target: { userId: state.user.id, email: request.email }, action, rolesBefore: state.roles, outcome: 'unknown' };
  }

  // Step 5: read the membership again. Only an active membership with exactly the expected roles counts as applied. A
  // failed write leaves its effect unknown, so the record says unknown before the failure reaches the caller.
  private async written(facts: RecordFacts, expected: readonly string[], write: () => Promise<OrganizationMembership>): Promise<OperatorRecord> {
    try {
      await write();
    } catch (error) {
      this.record({ ...facts, outcome: 'unknown', reason: 'the write failed, so its effect is not known' });
      throw error;
    }
    const userId = facts.target.userId ?? '';
    const current = await this.membership(userId, facts.organizationId);
    const rolesAfter = rolesOf(current);
    const applied = current?.status === 'active' && sameRoles(rolesAfter, expected);
    return this.record({ ...facts, rolesAfter, outcome: applied ? 'applied' : 'unknown', ...(applied ? {} : { reason: 'the membership differs from the change' }) });
  }

  private record(facts: RecordFacts): OperatorRecord {
    const record = Object.freeze({ time: new Date().toISOString(), actor: this.#actor, ...facts });
    this.records.push(record);
    return record;
  }
}
