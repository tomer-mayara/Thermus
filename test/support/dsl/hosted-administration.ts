import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { AccountFailureReport } from '../../../src/interfaces/web/account/account-routes.ts';
import type { ChangeRecord } from '../../../src/accounts/organizations/change-records.ts';
import { TeamBillingStub } from '../doubles/billing/team-billing-stub.ts';
import { formLabelled, formsIn, type BrowserAnswer, type HostedBrowser, type PageForm } from '../drivers/browser/hosted-browser.ts';
import { administrationMembers, userOf } from '../fixtures/hosted-members.ts';
import { serveOrganizationSite, type OrganizationSite, type SiteSetup } from '../in-process/hosted-organization-site.ts';

const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const recordFields = ['action', 'actor', 'organizationId', 'outcome', 'target', 'time'];

// The shared site behind the real HTTP server, with these memberships and a failure reporter that records each report.
// Each Acme member below has the MCP token "<subject>-token" for Acme, and cy and una also "<subject>-globex-token".
// Acme has 6 active product members, above the 5 seats of a free organization, so the organizations of the site are on
// the team plan, which has no member limit, unless a case gives another billing, such as BillingFree.
export async function serveAdministrationSite(t: TestContext, setup: Pick<SiteSetup, 'billing'> = {}) {
  const failures: AccountFailureReport[] = [];
  const site = await serveOrganizationSite(t, {
    billing: new TeamBillingStub(),
    ...setup,
    reportFailure: (report) => failures.push(report),
    memberships: administrationMembers,
    mcpUsers: ['user-sam', 'user-otto', 'user-cy', 'user-fay', 'user-una'].map((subject) => userOf(subject, 'org-a')),
    mcpTokens: new Map([['user-cy-globex-token', userOf('user-cy', 'org-b')], ['user-una-globex-token', userOf('user-una', 'org-b')]]),
  });
  return { ...site, failures };
}

interface ShownPage {
  readonly answer: BrowserAnswer;
  readonly forms: readonly PageForm[];
}

export async function shownPage(browser: HostedBrowser, path: string): Promise<ShownPage> {
  const answer = await browser.open(path);
  return { answer, forms: formsIn(answer.body) };
}

// The button of a form and the values of its visible fields.
interface FilledForm {
  readonly label: string;
  readonly filled: Readonly<Record<string, string>>;
}

export async function submitOnPage(browser: HostedBrowser, path: string, choice: string | FilledForm): Promise<BrowserAnswer> {
  const { label, filled } = typeof choice === 'string' ? { label: choice, filled: {} } : choice;
  const { answer, forms } = await shownPage(browser, path);
  assert.equal(answer.status, 200, answer.body);
  const form = formLabelled(forms, label);
  return browser.submit({ ...form, fields: { ...form.fields, ...filled } });
}

export function seatsIn(body: string): number | undefined {
  const match = /Active product members: (\d+)/.exec(body);
  return match === null ? undefined : Number(match[1]);
}

// The seat line of a free workspace on Members, such as "4 of 5 seats used", or undefined without one.
export function seatUsageIn(body: string): string | undefined {
  return /\b\d+ of \d+ seats used\b/.exec(body)?.[0];
}

// The refusal of an invitation beyond the 5 seats of a free workspace, in the words of the owner of 27 October 2026.
// It has no link: the Upgrade button comes with SO-13.
export function assertSeatLimitNotice(answer: BrowserAnswer): void {
  assert.equal(answer.status, 409, answer.body);
  assert.ok(answer.body.includes('<p>This free workspace has 5 of 5 seats. Upgrade to Team to add more members.</p>'), answer.body);
  assert.doesNotMatch(answer.body, /<a\b/);
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
