import type { ListOrganizationMembershipsOptions, OrganizationMembershipStatus, WorkOS } from '@workos-inc/node';
import type { WorkOSList } from './workos-answers.ts';

export interface MembershipRecord {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly status: OrganizationMembershipStatus;
  // WorkOS changes it with each change of the roles or the status.
  readonly updatedAt: string;
  readonly directoryManaged?: unknown;
  readonly roles?: readonly { readonly slug: string }[];
}

export interface MembershipReads {
  listOrganizationMemberships(options: ListOrganizationMembershipsOptions): Promise<WorkOSList<MembershipRecord>>;
  getOrganizationMembership(organizationMembershipId: string): Promise<MembershipRecord>;
}

interface MembershipWireRecord {
  readonly id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly organization_name: string;
  readonly status: OrganizationMembershipStatus;
  readonly updated_at: string;
  readonly directory_managed?: unknown;
  readonly roles?: MembershipRecord['roles'];
}

// SDK 11 defaults missing or null management evidence to false. Read it through the same client's transport before
// that default can make unknown evidence look ordinary. Each read still sends only one GET.
export function workosMembershipReads(workos: Pick<WorkOS, 'get'>): MembershipReads {
  return {
    async getOrganizationMembership(membershipId) {
      const id = encodeURIComponent(membershipId).replace(/%3A/gi, ':');
      if (id === '.' || id === '..') throw new TypeError('Invalid membership path segment');
      const { data } = await workos.get<MembershipWireRecord>(`/user_management/organization_memberships/${id}`);
      return membershipRecordOf(data);
    },
    async listOrganizationMemberships(options) {
      const query = { user_id: options.userId, organization_id: options.organizationId, statuses: options.statuses?.join(','), limit: options.limit, before: options.before, after: options.after, order: options.order || 'desc' };
      const { data } = await workos.get<{ readonly data: readonly MembershipWireRecord[]; readonly list_metadata: WorkOSList<MembershipRecord>['listMetadata'] }>('/user_management/organization_memberships', { query });
      return { data: data.data.map(membershipRecordOf), listMetadata: data.list_metadata };
    },
  };
}

function membershipRecordOf(record: MembershipWireRecord): MembershipRecord {
  return { id: record.id, userId: record.user_id, organizationId: record.organization_id, organizationName: record.organization_name, status: record.status, updatedAt: record.updated_at, directoryManaged: record.directory_managed, roles: record.roles };
}
