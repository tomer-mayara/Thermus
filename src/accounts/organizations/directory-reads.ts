import type { InvitationState, MembershipStatus, OrganizationDirectory, OrganizationInvitation, OrganizationMember, Page } from './organization-directory.ts';

const MEMBER_STATUSES: readonly MembershipStatus[] = Object.freeze(['active', 'inactive', 'pending']);
const PAGE_LIMIT = 1_000;

// Each membership of the organization in each status, read from every page. A failed page fails the read, so that no
// partial result looks complete.
export async function membersOf(directory: OrganizationDirectory, organizationId: string): Promise<readonly OrganizationMember[]> {
  const records = await readDirectoryPages((cursor) => directory.memberPage({ organizationId, statuses: MEMBER_STATUSES, cursor }));
  return latestOfEach(records, ({ membershipId }) => membershipId).filter((member) => member.organizationId === organizationId);
}

export async function invitationsOf(directory: OrganizationDirectory, organizationId: string, states: readonly InvitationState[]): Promise<readonly OrganizationInvitation[]> {
  const records = await readDirectoryPages((cursor) => directory.invitationPage({ organizationId, states, cursor }));
  return latestOfEach(records, ({ invitationId }) => invitationId).filter((invitation) => invitation.organizationId === organizationId);
}

// Reads each page in order. A read that does not end fails, with a repeated cursor or after the page limit.
export async function readDirectoryPages<T>(read: (cursor: string | undefined) => Promise<Page<T>>, limit = PAGE_LIMIT): Promise<readonly T[]> {
  const records: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let pages = 0; pages < limit; pages += 1) {
    const page = await read(cursor);
    records.push(...page.items);
    if (page.next === undefined) return records;
    if (cursors.has(page.next)) throw new Error('The directory repeated a page cursor');
    cursors.add(page.next);
    cursor = page.next;
  }
  throw new Error(`The directory gave more than ${limit} pages`);
}

// Each record once, by its ID. When pages repeat a record, the later page decides, because its read is more recent.
export function latestOfEach<T>(records: readonly T[], idOf: (record: T) => string): T[] {
  const latest = new Map<string, T>();
  for (const record of records) latest.set(idOf(record), record);
  return [...latest.values()];
}
