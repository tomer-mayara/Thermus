import type { RoleGrant } from '../../../../src/accounts/identity/access-context.ts';
import type { InvitationState, MembershipStatus, OrganizationMember, Page } from '../../../../src/accounts/organizations/organization-directory.ts';
import { adminGrant, memberRole, userGrant } from '../../fixtures/hosted-roles.ts';

export interface MemberSeed {
  readonly subject: string;
  readonly organizationId: string;
  readonly organizationName?: string;
  readonly status?: MembershipStatus;
  readonly grants: readonly RoleGrant[];
  readonly membershipId?: string;
  readonly email?: string;
}

export interface InvitationSeed {
  readonly organizationId: string;
  readonly email: string;
  readonly role: string;
  readonly state?: InvitationState;
  readonly invitationId?: string;
}

export interface MemberState {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly subject: string;
  readonly email: string;
  status: MembershipStatus;
  grants: readonly RoleGrant[];
  revision: number;
}

export interface InvitationRecord {
  readonly invitationId: string;
  readonly organizationId: string;
  readonly email: string;
  readonly role: string;
  state: InvitationState;
  // A credential of the invited person. The double gives it with each invitation, as a provider record has it, so that
  // a test can show that it reaches no page or record.
  readonly token: string;
}

// Lays out the records that match a page request on pages; an Error is a page that fails.
export type PageLayout<T> = (records: readonly T[]) => ReadonlyArray<readonly T[] | Error>;

const defaultRoleGrants: ReadonlyMap<string, RoleGrant> = new Map([
  ['user', userGrant],
  ['admin', adminGrant],
]);

function emailOf(subject: string): string {
  return `${subject.replace(/^user-/, '')}@example.com`;
}

export function membershipIdOf(subject: string, organizationId: string): string {
  return `membership-${subject}-${organizationId}`;
}

export function stateOf(seed: MemberSeed): MemberState {
  return {
    membershipId: seed.membershipId ?? membershipIdOf(seed.subject, seed.organizationId),
    organizationId: seed.organizationId,
    organizationName: seed.organizationName ?? `Organization ${seed.organizationId}`,
    subject: seed.subject,
    email: seed.email ?? emailOf(seed.subject),
    status: seed.status ?? 'active',
    grants: seed.grants,
    revision: 1,
  };
}

export function memberOf(state: MemberState): OrganizationMember {
  const { membershipId, organizationId, email, status, grants, revision } = state;
  return { membershipId, organizationId, email, status, grants, revision: `r${revision}` };
}

export function roleGrantOf(role: string): RoleGrant {
  const grant = defaultRoleGrants.get(role);
  if (grant === undefined) throw new Error(`The directory has no role ${role}`);
  return grant;
}

export function withRole(grants: readonly RoleGrant[], grant: RoleGrant): readonly RoleGrant[] {
  const others = grants.filter((current) => current.role !== grant.role && current.role !== memberRole.role);
  return [...others, grant];
}

// Without another role, the membership keeps the default role, which gives no application permission.
export function withoutRole(grants: readonly RoleGrant[], role: string): readonly RoleGrant[] {
  const remaining = grants.filter((grant) => grant.role !== role);
  return remaining.length === 0 ? [memberRole] : remaining;
}

export function chunks<T>(records: readonly T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let start = 0; start < records.length; start += size) pages.push(records.slice(start, start + size));
  return pages.length === 0 ? [[]] : pages;
}

export function pageAt<T>(pages: ReadonlyArray<readonly T[] | Error>, cursor: string | undefined): Page<T> {
  const index = cursor === undefined ? 0 : Number(/^page-(\d+)$/.exec(cursor)?.[1] ?? Number.NaN);
  const page = pages[index];
  if (page === undefined) throw new Error(`No page for the cursor ${cursor}`);
  if (page instanceof Error) throw page;
  return index + 1 < pages.length ? { items: page, next: `page-${index + 1}` } : { items: page };
}
