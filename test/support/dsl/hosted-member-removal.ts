import assert from 'node:assert/strict';
import { formsIn, type HostedBrowser, type PageForm } from '../drivers/browser/hosted-browser.ts';

export async function removalForm(browser: HostedBrowser, membershipId: string): Promise<PageForm> {
  const page = await browser.open('members');
  assert.equal(page.status, 200, page.body);
  const form = formsIn(page.body).find(candidate => candidate.fields.membership_id === membershipId);
  assert.ok(form, 'Members must offer a checked removal form for the selected member');
  return form;
}
