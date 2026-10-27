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
import { PendingInvitationsBrowser } from '../../support/drivers/browser/pending-invitations-browser.ts';
import { InvitationBrowser } from '../../support/drivers/browser/invitation-browser.ts';
import { AdminShellBrowser } from '../../support/drivers/browser/admin-shell-browser.ts';
import { memberActionStyle, memberRemovalBrowser, tabTo } from '../../support/drivers/browser/member-removal-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { otherOrganization, removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';
import { portalBuild } from '../../support/processes/module-paths.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';

test('Given three short member rows at 1280px and normal text, when Members loads its production fonts with removal closed, then labelled rows stay within 72px and quiet actions keep 48px targets', async (t) => {
  const { page } = await adminBrowser(t, { javaScriptEnabled: false });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto('https://thermus.example/team/members');
  const fonts = await page.locator('html').evaluate(async element => {
    await element.ownerDocument.fonts.ready;
    return { sans: element.ownerDocument.fonts.check('17px "IBM Plex Sans"'), serif: element.ownerDocument.fonts.check('500 32px "IBM Plex Serif"') };
  });
  assert.deepEqual(fonts, { sans: true, serif: true });
  const rows = page.locator('.member-list > li');
  assert.equal(await rows.count(), 3);
  const heights = await rows.evaluateAll(elements => elements.map(row => row.getBoundingClientRect().height));
  t.diagnostic(`Short closed member row heights ${JSON.stringify(heights)}`);
  const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
  if (evidence !== undefined) {
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, 'member-rows-compact-1280.png'), fullPage: true });
  }
  for (const row of await rows.all()) {
    assert.equal(await row.locator('details[open]').count(), 0);
    assert.deepEqual(await row.locator('dt').allTextContents(), ['Member', 'Role', 'Action']);
    const trigger = row.locator('summary');
    const target = await trigger.boundingBox();
    assert.ok(target && target.height >= 48 && target.width >= 48, 'Each quiet action must retain a 48px target');
    assert.deepEqual(await memberActionStyle(trigger), { color: 'rgb(180, 186, 192)', background: 'rgba(0, 0, 0, 0)', border: 'rgba(0, 0, 0, 0)' });
    for (const fact of await row.locator('dt, dd').all()) {
      assert.equal(await fact.isVisible(), true, 'Each labelled fact must remain visible');
      assert.equal(await fact.evaluate(element => element.clientHeight >= element.scrollHeight && element.clientWidth >= element.scrollWidth), true, 'Each labelled fact must fit without clipping');
    }
  }
  assert.ok(heights.every(height => height <= 72), `Short closed desktop rows must be at most 72px: ${heights.join(', ')}`);
});

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
    if (evidence !== undefined) await page.screenshot({ path: join(evidence, `member-row-expanded-text-200-${width}.png`), fullPage: true });
  });
}

test('Given an expanded removal at widths between phone and desktop, when the Admin reads its consequence, then confirmation has room for readable text', async (t) => {
  const { page } = await adminBrowser(t, { javaScriptEnabled: false });
  await page.goto('https://thermus.example/team/members');
  const target = page.locator('.member-list > li').filter({ has: page.getByText(removalUser.email, { exact: true }) }).locator('details');
  assert.equal(await target.count(), 1);
  await tabTo(page, target.locator('summary'));
  await page.keyboard.press('Enter');
  for (const width of [481, 600, 860, 861]) {
    await page.setViewportSize({ width, height: 844 });
    const confirmation = await target.locator('.removal-confirmation').boundingBox();
    assert.ok(confirmation && confirmation.width >= 240, `Confirmation text must stay readable at ${width}px`);
    assert.equal(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
    if (evidence !== undefined) {
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: join(evidence, `member-row-expanded-${width}.png`), fullPage: true });
    }
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

for (const javaScriptEnabled of [false, true]) {
  for (const width of [320, 1280]) {
    const layout = `JavaScript ${javaScriptEnabled ? 'on' : 'off'} at ${width}px`;
    for (const count of [0, 2]) {
      test(`Given a complete invitation overview with ${count} pending entries and terminal entries with ${layout}, when Members opens, then its counted native disclosure starts ${count === 0 ? 'closed' : 'open'} and can be discovered by keyboard`, async (t) => {
        const { site, page } = await adminBrowser(t, { javaScriptEnabled, setUp: world => {
          world.invitationPageSize = 1;
          world.invitations = [
            ...Array.from({ length: count }, (_, index) => ({ id: `pending-${index}`, email: `pending${index}@example.com`, organizationId: removalOrganization, roleSlug: 'user', state: 'pending' as const, expiresAt: '2099-10-26T12:00:00.000Z' })),
            { id: 'terminal', email: 'terminal@example.com', organizationId: removalOrganization, roleSlug: 'admin', state: 'revoked', expiresAt: '2099-10-26T12:00:00.000Z' },
          ];
        } });
        await page.setViewportSize({ width, height: 844 });
        site.world.fake.takeRequests();
        await page.goto('https://thermus.example/team/members');
        const disclosure = page.locator('details.pending-invitations');
        assert.equal(await disclosure.count(), 1, 'Pending invitations must be a native disclosure');
        assert.equal(await disclosure.locator('li').count(), count);
        assert.equal(await page.getByText('terminal@example.com', { exact: true }).count(), 0);
        await new PendingInvitationsBrowser(page, `${count}-${javaScriptEnabled ? 'on' : 'off'}-${width}`).discoverByKeyboard(count);
        assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'POST').length, 0);
      });
    }

    test(`Given short and long pending invitations with ${layout}, when Members is read at normal and 200% text, then compact rows show roles, UTC expiry and quiet allowed actions in order`, async (t) => {
      const { page } = await adminBrowser(t, { javaScriptEnabled, setUp: world => {
        world.invitations = [
          { id: 'short', email: 'new@example.com', organizationId: removalOrganization, roleSlug: 'user', state: 'pending', expiresAt: '2099-10-26T12:00:00.000Z' },
          { id: 'long', email: `${'long'.repeat(50)}@example.com`, organizationId: removalOrganization, roleSlug: 'admin', state: 'pending', expiresAt: '2099-10-26T12:00:00.000Z' },
        ];
      } });
      await page.setViewportSize({ width, height: 844 });
      await page.goto('https://thermus.example/team/members');
      await new PendingInvitationsBrowser(page, `${javaScriptEnabled ? 'on' : 'off'}-${width}`).inspectRows(width);
    });

    for (const action of ['Resend', 'Revoke'] as const) {
      test(`Given an independent pending invitation with ${layout}, when an Admin uses ${action} by keyboard, then one existing protected POST returns to Members with the current pending state`, async (t) => {
        const { site, page } = await adminBrowser(t, { javaScriptEnabled, setUp: world => {
          world.invitations = [{ id: 'pending-one', email: 'pending@example.com', organizationId: removalOrganization, roleSlug: 'user', state: 'pending', expiresAt: '2099-10-26T12:00:00.000Z' }];
        } });
        await page.setViewportSize({ width, height: 844 });
        await page.goto('https://thermus.example/team/members');
        site.world.fake.takeRequests();
        await new PendingInvitationsBrowser(page, `change-${action}-${width}`).change(action, 'pending@example.com');
        assert.equal(site.world.invitations[0]?.state, action === 'Resend' ? 'pending' : 'revoked');
        const pending = page.locator('details.pending-invitations');
        assert.equal(await pending.locator('summary').innerText(), `Pending invitations · ${action === 'Resend' ? 1 : 0}`);
        assert.equal(await pending.getAttribute('open') !== null, action === 'Resend');
        assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'POST').length, 1);
        assert.equal(site.removalStore.admissions.length, 0);
      });
    }
  }
}

test('Given Members without JavaScript, when an Admin first reads the page, then Invite member is a closed native disclosure with its form hidden', async (t) => {
  const { page } = await adminBrowser(t, { javaScriptEnabled: false });
  await page.goto('https://thermus.example/team/members');
  const disclosure = page.locator('details').filter({ has: page.getByText('Invite member', { exact: true }) });
  assert.equal(await disclosure.count(), 1, 'Members must offer a native Invite member disclosure');
  assert.equal(await disclosure.getAttribute('open'), null);
  assert.equal(await page.getByLabel('Email address', { exact: true }).isVisible(), false);
});

for (const javaScriptEnabled of [false, true]) {
  for (const width of [320, 1280]) {
    const options = { javaScriptEnabled, width };
    const layout = `JavaScript ${javaScriptEnabled ? 'on' : 'off'} at ${width}px`;
    test(`Given Members with ${layout}, when an Admin opens Invite member by keyboard and cancels a typed draft, then the native form discards input through a fresh GET without a write`, async (t) => {
      const { site, browser } = await invitationBrowser(t, options);
      await browser.inspectClosedHeading(width);
      await browser.openByKeyboard();
      await browser.inspectOpenForm(width);
      await browser.cancelDraft();
      assert.equal(site.world.invitations.length, 0);
      assert.equal(site.removalStore.admissions.length, 0);
    });

    test(`Given a fresh invitation form with ${layout}, when an Admin submits an invalid email with Admin selected, then native validation retains both values without a request`, async (t) => {
      const { site, browser } = await invitationBrowser(t, options);
      await browser.openByKeyboard();
      await browser.rejectInvalidEmail();
      assert.equal(site.world.invitations.length, 0);
    });

    test(`Given a fresh invitation form with ${layout}, when an Admin submits an existing member address, then the existing fixed refusal appears without form restoration or a write`, async (t) => {
      const { site, page, browser } = await invitationBrowser(t, options);
      await browser.openByKeyboard();
      assert.equal(await browser.submitForNotice(removalUser.email), 409);
      assert.equal(await page.getByRole('heading', { name: 'Invitation not sent', exact: true }).isVisible(), true);
      assert.match(await page.getByRole('main').innerText(), /An existing member cannot be invited again\. To replace a pending invitation, revoke it first\./);
      assert.equal(site.world.invitations.length, 0);
    });

    test(`Given a fresh invitation form with ${layout} and an uncertain provider result, when an Admin submits once, then the existing unconfirmed notice provides Check status without a restored form or retry`, async (t) => {
      const { site, page, browser } = await invitationBrowser(t, options);
      site.world.fake.answer('POST /user_management/invitations', { status: 500, body: { message: 'private-provider-failure' } });
      await browser.openByKeyboard();
      assert.equal(await browser.submitForNotice('uncertain@example.com'), 503);
      assert.equal(await page.getByRole('heading', { name: 'Invitation change not confirmed', exact: true }).isVisible(), true);
      assert.match(await page.getByRole('main').innerText(), /It may have taken effect\. Check the current status before making another change\./);
      assert.doesNotMatch(await page.getByRole('main').innerText(), /private-provider-failure|Try again|Retry/);
      assert.equal(await page.getByRole('link', { name: 'Check status', exact: true }).getAttribute('href'), '/team/members');
      assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'POST' && request.path === '/user_management/invitations').length, 1);
    });

    for (const role of ['User', 'Admin'] as const) {
      test(`Given a fresh invitation form with ${layout}, when an Admin submits ${role} once, then one protected POST creates that pending role and a 303 returns the closed Members form`, async (t) => {
        const { site, browser } = await invitationBrowser(t, options);
        await browser.openByKeyboard();
        const email = `new.${role.toLowerCase()}@example.com`;
        await browser.sendInvitation(email, role);
        assert.equal(site.world.invitations.filter(invitation => invitation.email === email && invitation.roleSlug === role.toLowerCase()).length, 1);
        assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'POST' && request.path === '/user_management/invitations').length, 1);
        assert.equal(site.removalStore.admissions.length, 0);
      });
    }
  }
}

for (const width of [481, 600, 860, 1280]) {
  test(`Given Members at ${width}px with long workspace text and JavaScript off, when Invite member opens with 200% text, then the heading, trigger and full form reflow without overlap`, async (t) => {
    const { page } = await adminBrowser(t, { javaScriptEnabled: false, setUp: world => {
      world.organizationNames = { ...world.organizationNames, [removalOrganization]: 'LongWorkspaceName'.repeat(12) };
    } });
    await page.setViewportSize({ width, height: 844 });
    const browser = new InvitationBrowser(page, `double-text-${width}`);
    await browser.openMembers();
    await browser.openByKeyboard();
    await browser.inspectDoubledText();
  });
}

for (const javaScriptEnabled of [false, true]) {
  test(`Given the last Admin with JavaScript ${javaScriptEnabled ? 'on' : 'off'}, when self-removal is refused and Invite another Admin is followed, then the guidance opens the ordinary closed Members invitation task`, async (t) => {
    const { site, page } = await adminBrowser(t, { javaScriptEnabled, setUp: world => {
      world.memberships = world.memberships.filter(member => member.userId !== 'user_ADMIN2');
    } });
    await page.goto('https://thermus.example/team/members');
    const targetId = site.world.membershipId(removalAdmin, removalOrganization);
    const details = page.locator('details.member-removal').filter({ has: page.locator(`input[name="membership_id"][value="${targetId}"]`) });
    await tabTo(page, details.locator('summary'));
    await page.keyboard.press('Enter');
    await tabTo(page, details.getByRole('button'));
    await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
    assert.equal(await page.getByRole('heading', { name: 'Keep an Admin', exact: true }).isVisible(), true);
    assert.match(await page.getByRole('main').innerText(), /On Members, open Invite member, select Admin, and wait for acceptance\./);
    const recovery = page.getByRole('link', { name: 'Invite another Admin', exact: true });
    assert.equal(await recovery.getAttribute('href'), '/team/invitations');
    await tabTo(page, recovery);
    await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
    const browser = new InvitationBrowser(page, `recovery-${javaScriptEnabled ? 'on' : 'off'}`);
    await browser.assertClosed();
    await browser.openByKeyboard();
    await page.getByRole('radio', { name: 'Admin', exact: true }).check();
    await page.getByLabel('Email address', { exact: true }).fill('replacement.admin@example.com');
    assert.equal(await page.getByRole('button', { name: 'Send invitation', exact: true }).isEnabled(), true);
    assert.equal(site.world.deletedMembershipIds.size, 0);
    assert.equal(site.world.invitations.length, 0);
    assert.equal(browser.posts.length, 0);
  });
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

for (const role of ['admin', 'user']) {
  for (const width of [320, 1280]) {
    test(`Given the built Connect page for ${role} at ${width}px, when workspace navigation opens and is used by keyboard, then compact header links follow the current role and fit the screen`, async (t) => {
      const { page } = await adminBrowser(t, { javaScriptEnabled: true, root: true, setUp: world => {
        world.memberships = world.memberships.map(member => member.userId === removalAdmin.id ? { ...member, roles: [role] } : member);
      } });
      await page.setViewportSize({ width, height: 844 });
      await new AdminShellBrowser(page, { javaScriptEnabled: true, width }).inspectConnect(role === 'admin');
    });
  }
}

async function adminBrowser(t: TestContext, options: { readonly javaScriptEnabled: boolean; readonly root?: boolean; readonly setUp?: (world: WorkOSFake) => void }) {
  const portal = await HostedPortal.load([], pathToFileURL(portalBuild));
  const settingsStore = new DestinationSettingsFake();
  const testEvents: string[] = [];
  const loggingService = new DestinationSettingsService(settingsStore, new Uint8Array(32).fill(7), { send: async (_destination, event) => { testEvents.push(event.eventName); return { kind: 'accepted' }; } });
  const site = await serveMemberRemovalSite(t, { config: options.root ? hostedRootConfig : undefined, portal, setUp: options.setUp, loggingService });
  const { browser: session } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const page = await memberRemovalBrowser(t, site.transport, { cookieHeader: session.cookieHeader ?? '', javaScriptEnabled: options.javaScriptEnabled });
  return { site, page, settingsStore, testEvents };
}

async function invitationBrowser(t: TestContext, options: { readonly javaScriptEnabled: boolean; readonly width: number }) {
  const { site, page } = await adminBrowser(t, options);
  await page.setViewportSize({ width: options.width, height: 844 });
  const browser = new InvitationBrowser(page, `${options.javaScriptEnabled ? 'on' : 'off'}-${options.width}`);
  await browser.openMembers();
  return { site, page, browser };
}
