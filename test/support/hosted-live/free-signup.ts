import assert from 'node:assert/strict';
import type { Organization } from '@workos-inc/node';
import type { Page } from 'playwright';
import type { LiveRun } from './live-run.ts';
import { signInToOrganizationSelector } from './portal-visit.ts';
import { localOrigin } from './settings.ts';
import { personalExternalId } from './signup-fixtures.ts';
import type { LiveUser } from './staging-fixtures.ts';

export interface FreeSignup {
  readonly page: Page;
  readonly organization: Organization;
}

// A verified user without memberships signs in, opens the Start free link of the marketing page, names the
// organization, accepts the one agreement, and lands on Quick start. The run deletes the new organization at its end.
export async function signUpAtFreeTier(run: LiveRun, user: LiveUser, organizationName: string): Promise<FreeSignup> {
  const { page } = await signInToOrganizationSelector(run, user);
  await page.goto(`${localOrigin}/signup?tier=free`);
  const agreement = page.getByRole('checkbox');
  assert.equal(await agreement.isChecked(), false);
  await page.getByRole('textbox', { name: 'Organization name', exact: true }).fill(organizationName);
  await agreement.check();
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await page.waitForURL(`${localOrigin}/quick-start`);
  const organization = await run.workos.organizations.getOrganizationByExternalId(personalExternalId(run.settings.clientId, user.id));
  run.recordFixture('organization', organization.id);
  return { page, organization };
}

// The portal reload of a meta refresh: the next load of the page, with no action of the user.
export async function nextReload(page: Page, timeoutMs: number): Promise<void> {
  await page.waitForEvent('load', { timeout: timeoutMs });
}
