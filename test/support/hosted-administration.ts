import assert from 'node:assert/strict';
import type { ChangeRecord } from '../../src/organizations/organization-administration.ts';
import { memberRole } from '../unit/organizations/fixtures/organization-directory-double.ts';
import { formsIn, type BrowserAnswer, type HostedBrowser, type PageForm } from './hosted-browser.ts';
import { adminGrant, formFor, member, superAdminGrant, userGrant, type OrganizationSite } from './hosted-organization-site.ts';
import type { MembershipRecord } from './membership-directory-double.ts';

const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const recordFields = ['action', 'actor', 'organizationId', 'outcome', 'target', 'time'];

// Acme (org-a) has 4 active memberships with User: otto, cy, fay, and una. The User grants of ivy, which is inactive,
// and of pia, which is pending, do not count. Globex (org-b) has 3: cy, una, and ben.
export const administrationMembers: readonly MembershipRecord[] = [
  member('user-sam', 'org-a', [superAdminGrant]),
  member('user-otto', 'org-a', [userGrant, adminGrant, superAdminGrant]),
  member('user-cy', 'org-a', [userGrant, adminGrant]),
  member('user-cy', 'org-b', [userGrant]),
  member('user-fay', 'org-a', [userGrant, adminGrant]),
  member('user-eve', 'org-a', [adminGrant]),
  member('user-una', 'org-a', [userGrant]),
  member('user-una', 'org-b', [userGrant]),
  member('user-ben', 'org-b', [userGrant, adminGrant]),
  { ...member('user-ivy', 'org-a', [userGrant]), active: false },
  member('user-dora', 'org-a', [memberRole]),
  { ...member('user-pia', 'org-a', [userGrant]), active: false, status: 'pending' },
];

export interface ShownPage {
  readonly answer: BrowserAnswer;
  readonly forms: readonly PageForm[];
}

export async function shownPage(browser: HostedBrowser, path: string): Promise<ShownPage> {
  const answer = await browser.open(path);
  return { answer, forms: formsIn(answer.body) };
}

// The button of a form and the values of its visible fields.
export interface FilledForm {
  readonly label: string;
  readonly filled: Readonly<Record<string, string>>;
}

// Opens the page, as a person does, and submits the form with this button, with its visible fields filled in.
export async function submitOnPage(browser: HostedBrowser, path: string, choice: string | FilledForm): Promise<BrowserAnswer> {
  const { label, filled } = typeof choice === 'string' ? { label: choice, filled: {} } : choice;
  const { answer, forms } = await shownPage(browser, path);
  assert.equal(answer.status, 200, answer.body);
  const form = formFor(forms, label);
  return browser.submit({ ...form, fields: { ...form.fields, ...filled } });
}

export function seatsIn(body: string): number | undefined {
  const match = /Active User seats: (\d+)/.exec(body);
  return match === null ? undefined : Number(match[1]);
}

export function rolesOf(site: Pick<OrganizationSite, 'directory'>, subject: string, organizationId: string): readonly string[] {
  return site.directory.membershipIn(subject, organizationId)?.grants.map(({ role }) => role) ?? [];
}

export async function toolOutcome(site: Pick<OrganizationSite, 'callTool'>, token: string): Promise<'done' | 'refused'> {
  return (await site.callTool(token)).isError === true ? 'refused' : 'done';
}

export function labelsOf(forms: readonly PageForm[]): readonly string[] {
  return forms.map(({ label }) => label);
}

// Each record as one line: "<actor> in <organization>: <action> <role> for <target>: <outcome>". Each record must have a
// time in ISO 8601 UTC, the actor of the provider double, and no field other than those of the contract.
export function recordLines(records: readonly ChangeRecord[]): readonly string[] {
  return records.map((record) => {
    assert.match(record.time, isoTime);
    assert.deepEqual(Object.keys(record).filter((field) => field !== 'role').sort(), recordFields);
    assert.deepEqual(Object.keys(record.actor).sort(), ['authority', 'subject']);
    assert.equal(record.actor.authority, 'hosted-provider-double');
    return `${record.actor.subject} in ${record.organizationId}: ${record.action} ${record.role ?? '-'} for ${Object.values(record.target).join()}: ${record.outcome}`;
  });
}
