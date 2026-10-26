import type { AuthenticatedUser, RoleGrant } from '../identity/access-context.ts';
import { latestOfEach, readDirectoryPages } from './directory-reads.ts';
import type { OrganizationDirectory, OrganizationMember, OrganizationMembership } from './organization-directory.ts';
import type { MemberRemovalRequest } from './removal-operation-store.ts';

type RemovalRefusal = 'denied' | 'stale' | 'unsupported' | 'last-admin';
type CurrentRead = <T>(read: (signal: AbortSignal) => Promise<T>) => Promise<T>;
const REMOVAL_PAGE_LIMIT = 10;

const adminPermissions = ['product:access', 'user-grants:manage', 'admin-grants:manage'];

export function currentAdmin(memberships: readonly OrganizationMembership[], organizationId: string): boolean {
  return memberships.some(member => member.active && member.organizationId === organizationId
    && member.organizationName.trim() !== '' && adminGrants(member.grants));
}

export async function checkRemoval(directory: OrganizationDirectory, user: AuthenticatedUser, request: MemberRemovalRequest, read: CurrentRead): Promise<RemovalRefusal | undefined> {
  if (!currentAdmin(await read(signal => directory.membershipsOf(user, signal)), request.organizationId)) return 'denied';
  const target = await read(signal => directory.member(request.membershipId, signal));
  if (target === undefined) return 'stale';
  const refusal = targetRefusal(target, request);
  if (refusal !== undefined) return refusal;
  const originalFacts = targetFacts(target);
  const pages = await readDirectoryPages(cursor => read(signal => directory.memberPage({ organizationId: request.organizationId, statuses: ['active'], cursor, signal })), REMOVAL_PAGE_LIMIT);
  const members = latestOfEach(pages, member => member.membershipId).filter(member => member.organizationId === request.organizationId && member.status === 'active');
  const currentTarget = members.find(member => member.membershipId === request.membershipId);
  if (currentTarget === undefined || targetFacts(currentTarget) !== originalFacts) return 'stale';
  if (!members.some(member => member.subject === user.subject && adminGrants(member.grants))) return 'denied';
  if (adminGrants(currentTarget.grants) && members.filter(member => adminGrants(member.grants)).length < 2) return 'last-admin';
  return undefined;
}

function targetRefusal(target: OrganizationMember, request: MemberRemovalRequest): RemovalRefusal | undefined {
  if (target.organizationId !== request.organizationId || target.membershipId !== request.membershipId) return 'denied';
  if (target.revision !== request.revision) return 'stale';
  if (!removalSupported(target)) return 'unsupported';
  return undefined;
}

// The overview uses this snapshot only to offer the form. Removal checks current facts again.
export function removalSupported(member: OrganizationMember): boolean {
  return member.status === 'active' && member.management === 'ordinary'
    && member.grants.length > 0 && member.grants.every(grant => ['user', 'admin'].includes(grant.role));
}

function adminGrants(grants: readonly RoleGrant[]): boolean {
  const permissions = new Set(grants.flatMap(grant => grant.permissions));
  return grants.some(grant => grant.role === 'admin') && adminPermissions.every(permission => permissions.has(permission));
}

// Preserve the direct read before later awaits can expose another mutable provider record.
function targetFacts(target: OrganizationMember): string {
  const grants = target.grants.map(grant => [grant.role, [...grant.permissions].sort()]).sort(([left], [right]) => String(left).localeCompare(String(right)));
  return JSON.stringify([target.membershipId, target.subject, target.organizationId, target.status, target.management, target.revision, grants]);
}
