import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { micromark } from 'micromark';
import { parseHTML } from 'linkedom';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import type { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import { DestinationSettingsFake } from '../../support/doubles/logging/destination-settings-fake.ts';
import { HostedPortal } from '../../../src/app/hosted-portal.ts';
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
      await page.locator('html').evaluate(element => element.ownerDocument.fonts.ready);
      const title = await page.getByRole('heading', { name: 'Members', exact: true }).evaluate(element => {
        const style = element.ownerDocument.defaultView!.getComputedStyle(element);
        return { size: style.fontSize, family: style.fontFamily };
      });
      const main = await page.getByRole('main').boundingBox();
      const list = await page.getByRole('region', { name: 'Active members', exact: true }).boundingBox();
      const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
      if (evidence !== undefined) {
        await mkdir(evidence, { recursive: true });
        await page.screenshot({ path: join(evidence, `members-layout-${javaScriptEnabled ? 'on' : 'off'}-${width}.png`), fullPage: true });
      }
      assert.ok(main && list && Math.abs(main.width - list.width) <= 1, 'The member list must use the full available content width');
      assert.equal(title.size, '32px', 'The shared page title must stay at 32px');
      assert.match(title.family, /IBM Plex Serif/);
      const banner = page.getByRole('banner');
      assert.equal(await banner.getByText(organizationName, { exact: true }).isVisible(), true);
      assert.equal(await banner.getByRole('link', { name: 'Switch workspace', exact: true }).evaluate(element => element.parentElement?.textContent), `${organizationName}Switch workspace`);
      assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Long workspace and member values must fit');
      const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
      await page.keyboard.press('Tab');
      assert.equal(await skip.evaluate(element => element.matches(':focus')), true);
      const focus = await skip.evaluate(element => {
        const style = element.ownerDocument.defaultView!.getComputedStyle(element);
        return { outline: style.outlineWidth, outlineColor: style.outlineColor, text: style.color, background: style.backgroundColor };
      });
      assert.equal(focus.outline, '3px');
      assert.equal(focus.outlineColor, 'rgb(243, 242, 238)');
      assert.equal(focus.text, 'rgb(23, 24, 29)');
      assert.equal(focus.background, 'rgb(243, 242, 238)');
      const measurements = {
        javaScriptEnabled, width, title, main, list, focus,
        text: await page.locator('body').evaluate(element => {
          const style = element.ownerDocument.defaultView!.getComputedStyle(element);
          return { color: style.color, background: style.backgroundColor, family: style.fontFamily, sansLoaded: element.ownerDocument.fonts.check('17px "IBM Plex Sans"'), serifLoaded: element.ownerDocument.fonts.check('500 32px "IBM Plex Serif"') };
        }),
        navigation: await banner.locator('a').evaluateAll(elements => elements.map(element => {
          const style = element.ownerDocument.defaultView!.getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          return { name: element.textContent, font: style.fontFamily, size: style.fontSize, color: style.color, border: style.borderBottomColor, width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
        })),
        surface: await page.getByRole('region', { name: 'Active members', exact: true }).evaluate(element => {
          const style = element.ownerDocument.defaultView!.getComputedStyle(element);
          return { color: style.color, background: style.backgroundColor, border: style.borderColor };
        }),
      };
      assert.equal(measurements.text.sansLoaded, true);
      assert.equal(measurements.text.serifLoaded, true);
      if (evidence !== undefined) await writeFile(join(evidence, `measurements-${javaScriptEnabled ? 'on' : 'off'}-${width}.json`), JSON.stringify(measurements, null, 2));
      const skipBounds = await skip.boundingBox();
      assert.ok(skipBounds && skipBounds.x >= 0 && skipBounds.y >= 0 && skipBounds.x + skipBounds.width <= width);
      await page.keyboard.press('Enter');
      assert.equal(await page.getByRole('main').evaluate(element => element.matches(':focus')), true, 'Skip to content must move focus into main');
      for (const label of ['Connect', 'Members', 'Audit logs', 'Switch workspace']) {
        const link = banner.getByRole('link', { name: label, exact: true });
        const bounds = await link.boundingBox();
        assert.ok(bounds && bounds.height >= 48 && bounds.width >= 48 && bounds.x >= 0 && bounds.x + bounds.width <= width, `${label} must have a visible 48px target`);
      }
      const invite = page.getByRole('button', { name: 'Invite', exact: true });
      assert.ok((await invite.boundingBox())!.height >= 48);
      const help = page.locator('details[data-help="members"]');
      await tabTo(page, help.locator('summary'));
      await page.keyboard.press('Enter');
      assert.notEqual(await help.getAttribute('open'), null);
      assert.match(await help.innerText(), /Do not submit another\s+removal/);
      await page.locator('body').evaluate(body => {
        const sizes = [...body.querySelectorAll('*')].map(element => ({ element, size: Number.parseFloat(element.ownerDocument.defaultView!.getComputedStyle(element).fontSize) }));
        for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
      });
      assert.equal(await page.getByRole('heading', { name: 'Members', exact: true }).evaluate(element => element.ownerDocument.defaultView!.getComputedStyle(element).fontSize), '64px', 'Text must be increased to 200% for reflow checks');
      assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Expanded help and doubled text must reflow without horizontal scrolling');
      if (evidence !== undefined) await page.screenshot({ path: join(evidence, `members-expanded-text-200-${javaScriptEnabled ? 'on' : 'off'}-${width}.png`), fullPage: true });
      await page.goto('https://thermus.example/team/members');
      await tabTo(page, banner.getByRole('link', { name: 'Audit logs', exact: true }));
      await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
      assert.equal(await page.getByRole('heading', { name: 'Audit logs', exact: true }).isVisible(), true);
      assert.equal(await page.locator('header [aria-current="page"]').innerText(), 'Audit logs');
      assert.equal(await banner.getByText(organizationName, { exact: true }).count(), 0, 'Audit must keep its existing context without a workspace-name lookup');
      assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('button', { name: 'Test', exact: true }).isVisible(), true);
      assert.equal(await page.getByLabel('OTLP logs endpoint', { exact: true }).isVisible(), true);
      assert.equal(await page.getByLabel('Bearer token', { exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('switch', { name: 'Enable export' }).isVisible(), true);
      assert.equal(await page.getByLabel('Axiom dataset', { exact: true }).isVisible(), !javaScriptEnabled);
      await page.getByRole('radio', { name: 'Axiom', exact: true }).check();
      assert.equal(await page.getByLabel('Axiom dataset', { exact: true }).isVisible(), true);
      await page.getByRole('radio', { name: 'Custom', exact: true }).check();
      assert.equal(await page.getByLabel('Axiom dataset', { exact: true }).isVisible(), !javaScriptEnabled);
      for (const label of ['Save', 'Test']) assert.ok((await page.getByRole('button', { name: label, exact: true }).boundingBox())!.height >= 48);
      assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Audit controls must fit');
      const auditHelp = page.locator('details[data-help="audit"]');
      await tabTo(page, auditHelp.locator('summary'));
      await page.keyboard.press('Enter');
      assert.notEqual(await auditHelp.getAttribute('open'), null);
      assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Expanded Audit help must fit with its controls');
      if (evidence !== undefined) await page.screenshot({ path: join(evidence, `audit-controls-${javaScriptEnabled ? 'on' : 'off'}-${width}.png`), fullPage: true });
      await page.getByLabel('OTLP logs endpoint', { exact: true }).fill('https://collector.example/v1/logs');
      await page.getByLabel('Bearer token', { exact: true }).fill('browser-test-token');
      const posts: string[] = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
      await tabTo(page, page.getByRole('button', { name: 'Save', exact: true }));
      await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
      assert.equal(await page.locator('#logging-saved').innerText(), 'saved');
      assert.equal(settingsStore.writes, 1);
      assert.equal(await page.getByLabel('Bearer token', { exact: true }).inputValue(), '');
      await tabTo(page, page.getByRole('button', { name: 'Test', exact: true }));
      await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
      assert.equal(await page.getByRole('heading', { name: 'Test accepted', exact: true }).isVisible(), true);
      assert.equal(await page.getByText('Settings saved. Destination accepted the Test event.', { exact: true }).isVisible(), true);
      assert.deepEqual(posts, ['/team/logging/save', '/team/logging/test']);
      assert.equal(settingsStore.writes, 2);
      assert.deepEqual(testEvents, ['audit.destination.test']);
      assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).isVisible(), true);
      await tabTo(page, banner.getByRole('link', { name: 'Members', exact: true }));
      await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
      assert.equal(await page.locator('header [aria-current="page"]').innerText(), 'Members');
      assert.equal(await banner.getByText(organizationName, { exact: true }).isVisible(), true);
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
