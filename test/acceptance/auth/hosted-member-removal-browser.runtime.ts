import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { micromark } from 'micromark';
import { parseHTML } from 'linkedom';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import type { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import { DestinationSettingsFake } from '../../support/doubles/logging/destination-settings-fake.ts';
import { HostedPortal } from '../../../src/app/hosted-portal.ts';
import { AdminShellBrowser } from '../../support/drivers/browser/admin-shell-browser.ts';
import { memberRemovalBrowser, tabTo } from '../../support/drivers/browser/member-removal-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';
import { portalBuild } from '../../support/processes/module-paths.ts';

test('Given Members at a 320 by 844 viewport, when an Admin uses the keyboard to open, cancel, and confirm Remove, then the controls have names, cancellation writes nothing, and confirmation removes only the chosen membership', async (t) => {
  const { site, page } = await adminBrowser(t, { javaScriptEnabled: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('https://thermus.example/team/members');
  assert.equal(await page.getByRole('img', { name: 'thermus', exact: true }).evaluate(element => element.complete && element.naturalWidth > 0), true, 'The real Thermus logo must load');
  const fonts = await page.locator('html').evaluate(async element => {
    await element.ownerDocument.fonts.ready;
    return { sans: element.ownerDocument.fonts.check('17px "IBM Plex Sans"'), serif: element.ownerDocument.fonts.check('500 32px "IBM Plex Serif"') };
  });
  assert.deepEqual(fonts, { sans: true, serif: true }, 'The production fonts must load before layout checks');
  const preview = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
  if (preview !== undefined) {
    await mkdir(preview, { recursive: true });
    await page.screenshot({ path: join(preview, 'members-normal-320.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.screenshot({ path: join(preview, 'members-normal-1280.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 844 });
  }
  const help = page.locator('details[data-help="members"]');
  assert.equal(await help.getAttribute('open'), null);
  await tabTo(page, help.locator('summary'));
  await page.keyboard.press('Enter');
  assert.notEqual(await help.getAttribute('open'), null);
  assert.match(await help.innerText(), /Do not submit another\s+removal/);
  assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= 320), true, 'The expanded removal help must fit the narrow viewport');
  const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
  if (evidence !== undefined) {
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, 'members-help-narrow.png'), fullPage: true });
  }
  await page.keyboard.press('Enter');
  assert.equal(await help.getAttribute('open'), null);
  assert.equal(site.removalStore.admissions.length, 0);
  const targetId = site.world.membershipId(removalUser, removalOrganization);
  const details = page.locator('details').filter({ has: page.locator(`input[name="membership_id"][value="${targetId}"]`) });
  assert.equal(await details.count(), 1, 'Members must have a native removal confirmation for the chosen User');
  const summary = details.locator('summary');
  assert.match(await summary.innerText(), /Remove/);
  await tabTo(page, summary);
  await page.keyboard.press('Enter');
  assert.notEqual(await details.getAttribute('open'), null);
  assert.match(await details.innerText(), /user@example\.com/);
  const cancel = details.getByRole('link', { name: 'Cancel', exact: true });
  await tabTo(page, cancel);
  await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
  assert.equal(site.removalStore.admissions.length, 0);
  assert.equal(site.world.deletedMembershipIds.size, 0);
  assert.equal(await details.getAttribute('open'), null);

  await tabTo(page, summary);
  await page.keyboard.press('Enter');
  const confirm = details.getByRole('button');
  assert.match(await confirm.innerText(), /Remove/);
  await tabTo(page, confirm);
  assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= 320), true, 'The narrow page must not overflow horizontally');
  const bounds = await confirm.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320, 'The confirmation must fit the viewport');
  if (evidence !== undefined) {
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, 'members-remove-narrow.png'), fullPage: true });
  }
  await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
  assert.deepEqual([...site.world.deletedMembershipIds], [targetId]);
  assert.equal(site.removalStore.operations.get(removalOrganization)?.outcome, 'applied');
  assert.equal(await page.locator('form').count(), 0, 'The result page must not repeat the removal form');
});

test('Given Audit logs without JavaScript, when an Admin opens full help by keyboard at narrow and desktop widths, then all approved text and links are readable without overflow or a write', async (t) => {
  const { site, page } = await adminBrowser(t, { javaScriptEnabled: false });
  await page.goto('https://thermus.example/team/logging');
  const help = page.locator('details[data-help="audit"]');
  assert.equal(await help.getAttribute('open'), null);
  await tabTo(page, help.locator('summary'));
  await page.keyboard.press('Enter');
  assert.notEqual(await help.getAttribute('open'), null);
  const canonical = await readFile('docs/legal/organization-removal-2026-10-26-proposal-v1/audit-help.md', 'utf8');
  const expected = parseHTML(`<div>${micromark(canonical)}</div>`).document.querySelector('div')?.textContent;
  assert.equal(await help.locator('.administration-help-content').textContent(), expected);
  assert.equal(await help.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href'), 'https://thermus.ai/privacy/');
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Expanded Audit help must fit the viewport');
    const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
    if (evidence !== undefined) {
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: join(evidence, `audit-help-${width}.png`), fullPage: true });
    }
  }
  assert.equal(site.removalStore.admissions.length, 0);
  assert.equal(site.world.deletedMembershipIds.size, 0);
});

test('Given Audit logs at tablet widths without JavaScript, when an Admin opens its settings, then the form keeps the full content width', async (t) => {
  const { page } = await adminBrowser(t, { javaScriptEnabled: false });
  for (const width of [800, 860]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('https://thermus.example/team/logging');
    const navigation = await page.getByRole('navigation', { name: 'Workspace' }).boundingBox();
    const main = await page.getByRole('main').boundingBox();
    const destination = await page.getByRole('region', { name: 'Audit log destination', exact: true }).boundingBox();
    assert.ok(navigation && main && destination, 'Audit navigation, content and settings must be visible');
    assert.equal(main.width, navigation.width, 'Audit must keep the available content width at tablet sizes');
    assert.equal(destination.width, main.width, 'Audit settings must keep the full content width');
    console.log('Audit tablet geometry', JSON.stringify({ width, navigation, main, destination }));
    const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
    if (evidence !== undefined) {
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: join(evidence, `audit-tablet-${width}.png`), fullPage: true });
    }
  }
});

for (const javaScriptEnabled of [false, true]) {
  for (const width of [320, 1280]) {
    test(`Given built Members with JavaScript ${javaScriptEnabled ? 'on' : 'off'} at ${width}px, when an Admin reads long values and uses shared navigation, then full-width content, keyboard focus, doubled text and Audit controls stay usable`, async (t) => {
      const organizationName = `Acme Labs ${'LongWorkspaceName'.repeat(8)}`;
      const longEmail = `${'member'.repeat(22)}@example.com`;
      const { site, page, settingsStore, testEvents } = await adminBrowser(t, { javaScriptEnabled, setUp: world => {
        world.organizationNames = { ...world.organizationNames, [removalOrganization]: organizationName };
        world.users = world.users.map(user => user.id === removalUser.id ? { ...user, email: longEmail } : user);
        world.invitations = [{ id: 'pending-long', email: `${'pending'.repeat(20)}@example.com`, organizationId: removalOrganization, roleSlug: 'user', state: 'pending', expiresAt: '2099-10-26T12:00:00.000Z' }];
      } });
      await page.setViewportSize({ width, height: 844 });
      await page.goto('https://thermus.example/team/members');
      const browser = new AdminShellBrowser(page, { javaScriptEnabled, width });
      await browser.inspectMembers(organizationName);
      await browser.expandMembersHelpWithDoubleText();
      await browser.openAudit(organizationName);
      await browser.inspectAuditControls();
      const posts = browser.recordWrites();
      await browser.saveDestination();
      assert.equal(settingsStore.writes, 1);
      await browser.testDestination();
      assert.deepEqual(posts, ['/team/logging/save', '/team/logging/test']);
      assert.equal(settingsStore.writes, 2);
      assert.deepEqual(testEvents, ['audit.destination.test']);
      await browser.returnToMembers(organizationName);
      assert.equal(site.removalStore.admissions.length, 0);
      assert.equal(site.world.deletedMembershipIds.size, 0);
    });
  }
}

async function adminBrowser(t: TestContext, options: { readonly javaScriptEnabled: boolean; readonly setUp?: (world: WorkOSFake) => void }) {
  const portal = await HostedPortal.load([], pathToFileURL(portalBuild));
  const settingsStore = new DestinationSettingsFake();
  const testEvents: string[] = [];
  const loggingService = new DestinationSettingsService(settingsStore, new Uint8Array(32).fill(7), { send: async (_destination, event) => { testEvents.push(event.eventName); return { kind: 'accepted' }; } });
  const site = await serveMemberRemovalSite(t, { portal, setUp: options.setUp, loggingService });
  const { browser: session } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const page = await memberRemovalBrowser(t, site.transport, session.cookieHeader ?? '', { javaScriptEnabled: options.javaScriptEnabled });
  return { site, page, settingsStore, testEvents };
}
