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
import { memberActionStyle, memberRemovalBrowser, tabTo } from '../../support/drivers/browser/member-removal-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { otherOrganization, removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';
import { portalBuild } from '../../support/processes/module-paths.ts';

test('Given closed member actions, when an Admin reads the page, then each disclosure uses quiet text with no danger fill', async (t) => {
  const { page } = await adminBrowser(t, { javaScriptEnabled: false });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto('https://thermus.example/team/members');
  const triggers = page.locator('.member-list summary');
  assert.equal(await triggers.count(), 3);
  for (const trigger of await triggers.all()) assert.deepEqual(await memberActionStyle(trigger), { color: 'rgb(180, 186, 192)', background: 'rgba(0, 0, 0, 0)', border: 'rgba(0, 0, 0, 0)' });
});

for (const width of [320, 1280]) {
  test(`Given labelled member rows at ${width}px without JavaScript, when an Admin reads long facts and opens removal, then columns align, the trigger is quiet, and only confirmation is red`, async (t) => {
    const longEmail = `${'member'.repeat(22)}@example.com`;
    const { page } = await adminBrowser(t, { javaScriptEnabled: false, setUp: world => {
      world.users = world.users.map(user => user.id === removalUser.id ? { ...user, email: longEmail } : user);
    } });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('https://thermus.example/team/members');
    await page.locator('html').evaluate(element => element.ownerDocument.fonts.ready);
    const rows = page.locator('.member-list > li');
    assert.equal(await rows.count(), 3);
    const geometry = await rows.evaluateAll(elements => elements.map(row => [...row.querySelectorAll('dt')].map(label => ({ text: label.textContent, x: label.getBoundingClientRect().x, y: label.getBoundingClientRect().y }))));
    const first = geometry[0];
    assert.ok(first);
    assert.deepEqual(first.map(label => label.text), ['Member', 'Role', 'Action']);
    if (width === 1280) {
      for (const labels of geometry) {
        assert.deepEqual(labels.map(label => label.x), first.map(label => label.x));
        const firstLabel = labels[0];
        assert.ok(firstLabel);
        assert.ok(labels.every(label => label.y === firstLabel.y), 'Row labels must align on one line');
      }
    }
    const details = rows.filter({ has: page.getByText(longEmail, { exact: true }) }).locator('details');
    const trigger = details.locator('summary');
    assert.equal(await trigger.getAttribute('aria-label'), `Remove ${longEmail} from Acme`);
    const quiet = await memberActionStyle(trigger);
    assert.deepEqual(quiet, { color: 'rgb(180, 186, 192)', background: 'rgba(0, 0, 0, 0)', border: 'rgba(0, 0, 0, 0)' });
    await tabTo(page, trigger);
    await page.keyboard.press('Enter');
    const confirm = details.getByRole('button');
    assert.deepEqual(await memberActionStyle(confirm), { color: 'rgb(255, 205, 210)', background: 'rgb(64, 40, 44)', border: 'rgb(198, 110, 118)' });
    for (const target of [trigger, confirm, details.getByRole('link', { name: 'Cancel', exact: true })]) {
      const bounds = await target.boundingBox();
      assert.ok(bounds && bounds.height >= 48 && bounds.width >= 48 && bounds.x >= 0 && bounds.x + bounds.width <= width, 'Each action needs a visible 48px target');
    }
    assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Long member facts and expanded confirmation must reflow');
    const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
    if (evidence !== undefined) {
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: join(evidence, `member-row-expanded-${width}.png`), fullPage: true });
    }
    await rows.evaluateAll(elements => {
      for (const row of elements) {
        const view = row.ownerDocument.defaultView;
        if (view === null) throw new Error('The member row has no browser window');
        const sizes = [...row.querySelectorAll('*')].map(element => ({ element, size: Number.parseFloat(view.getComputedStyle(element).fontSize) }));
        for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
      }
    });
    assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Expanded removal and member facts must reflow at 200% text');
  });
}

test('Given an expanded removal at widths between phone and desktop, when the Admin reads its consequence, then confirmation has room for readable text', async (t) => {
  const { page } = await adminBrowser(t, { javaScriptEnabled: false });
  await page.goto('https://thermus.example/team/members');
  const target = page.locator('.member-list > li').filter({ has: page.getByText(removalUser.email, { exact: true }) }).locator('details');
  assert.equal(await target.count(), 1);
  await tabTo(page, target.locator('summary'));
  await page.keyboard.press('Enter');
  for (const width of [481, 600, 860]) {
    await page.setViewportSize({ width, height: 844 });
    const confirmation = await target.locator('.removal-confirmation').boundingBox();
    assert.ok(confirmation && confirmation.width >= 240, `Confirmation text must stay readable at ${width}px`);
    assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true);
  }
});

for (const self of [false, true]) {
  const target = self ? removalAdmin : removalUser;
  const summaryText = self ? 'Leave…' : 'Remove…';
  const summaryName = self ? `Leave Acme as ${target.email}` : `Remove ${target.email} from Acme`;
  const confirmationName = self ? 'Leave Acme' : `Remove ${target.email}`;
  for (const cancel of [true, false]) {
    const expectedPosts = cancel ? [] : ['/team/members/remove'];
    const expectedWrites = cancel ? 0 : 1;
    for (const width of [320, 1280]) {
      test(`Given a fresh ${self ? 'self Leave' : 'other Remove'} confirmation without JavaScript at ${width}px and another Admin, when the Admin uses the keyboard to ${cancel ? 'Cancel' : 'confirm once'}, then ${cancel ? 'a GET closes the disclosure without a write' : 'one POST removes only that membership and gives recovery links'}`, async (t) => {
        const { site, page } = await adminBrowser(t, { javaScriptEnabled: false, setUp: world => {
          world.memberships = [...world.memberships, { userId: removalAdmin.id, organizationId: otherOrganization, roles: ['user'], directoryManaged: false }];
        } });
        const accounts = structuredClone(site.world.users);
        const memberships = structuredClone(site.world.memberships);
        const targetId = site.world.membershipId(target, removalOrganization);
        const otherId = site.world.membershipId(target, otherOrganization);
        await page.setViewportSize({ width, height: 844 });
        await page.goto('https://thermus.example/team/members');
        const posts: string[] = [];
        page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
        site.world.fake.takeRequests();
        const details = page.locator('details').filter({ has: page.locator(`input[name="membership_id"][value="${targetId}"]`) });
        const summary = details.locator('summary');
        assert.equal(await summary.innerText(), summaryText);
        assert.equal(await summary.getAttribute('aria-label'), summaryName);
        assert.equal(await details.getAttribute('open'), null);
        await tabTo(page, summary);
        await page.keyboard.press('Enter');
        assert.notEqual(await details.getAttribute('open'), null);
        assert.match(await details.innerText(), new RegExp(`Remove ${target.email.replaceAll('.', '\\.')} from Acme\\?`));
        assert.match(await details.innerText(), /This removes access to this workspace\. The account and access to other workspaces remain\./);
        const action = cancel ? details.getByRole('link', { name: 'Cancel', exact: true }) : details.getByRole('button', { name: confirmationName, exact: true });
        if (cancel) assert.equal(await action.getAttribute('href'), '/team/members');
        await tabTo(page, action);
        await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
        assert.deepEqual(posts, expectedPosts);
        assert.deepEqual([...site.world.deletedMembershipIds], cancel ? [] : [targetId]);
        assert.equal(site.removalStore.admissions.length, expectedWrites);
        assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, expectedWrites);
        assert.deepEqual(site.world.users, accounts, 'The accounts must remain');
        assert.deepEqual(site.world.memberships, memberships, 'Other workspace memberships must remain');
        assert.equal(site.world.deletedMembershipIds.has(otherId), false);
        if (cancel) {
          assert.equal(await details.getAttribute('open'), null);
          assert.equal(new URL(page.url()).pathname, '/team/members');
        } else {
          assert.equal(await page.getByRole('heading', { name: 'Member removed', exact: true }).isVisible(), true);
          assert.equal(await page.getByRole('link', { name: 'Read current Members', exact: true }).isVisible(), true);
          assert.equal(await page.getByRole('link', { name: 'Choose a workspace or check access', exact: true }).isVisible(), true);
          assert.equal(await page.getByRole('link', { name: 'sign in again', exact: true }).isVisible(), true);
          assert.equal(await page.locator('form').count(), 0, 'The result must not repeat removal');
        }
      });
    }
  }
}

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
