import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { tabTo } from './member-removal-browser.ts';

export class PendingInvitationsBrowser {
  constructor(private readonly page: Page, private readonly suffix: string) {}

  private get disclosure() { return this.page.locator('details.pending-invitations'); }

  async discoverByKeyboard(count: number): Promise<void> {
    assert.equal(await this.disclosure.locator('summary').innerText(), `Pending invitations · ${count}`);
    assert.equal(await this.disclosure.getAttribute('open') !== null, count > 0);
    await tabTo(this.page, this.disclosure.locator('summary'));
    const focus = await this.disclosure.locator('summary').evaluate(element => {
      const style = element.ownerDocument.defaultView!.getComputedStyle(element);
      return { width: style.outlineWidth, color: style.outlineColor };
    });
    assert.deepEqual(focus, { width: '3px', color: 'rgb(243, 242, 238)' });
    await this.screenshot('initial-focus');
    await this.page.keyboard.press('Enter');
    assert.equal(await this.disclosure.getAttribute('open') !== null, count === 0);
    if (count === 0) {
      assert.equal(await this.disclosure.getByText('No pending invitations.', { exact: true }).isVisible(), true);
    } else {
      assert.equal(await this.disclosure.locator('.invitation-row').first().isVisible(), false);
      await this.page.keyboard.press('Enter');
      assert.equal(await this.disclosure.locator('.invitation-row').first().isVisible(), true);
    }
  }

  async inspectRows(width: number): Promise<void> {
    await this.page.locator('html').evaluate(element => element.ownerDocument.fonts.ready);
    const row = this.disclosure.locator('.invitation-row').first();
    const bounds = await row.boundingBox();
    assert.ok(bounds && bounds.height <= (width === 320 ? 240 : 80), 'Short pending rows must be compact');
    const pending = await this.disclosure.boundingBox();
    const members = await this.page.getByRole('region', { name: 'Active members', exact: true }).boundingBox();
    const help = await this.page.locator('details[data-help="members"]').boundingBox();
    const invite = await this.page.locator('details.member-invitation').boundingBox();
    assert.ok(pending && members && help && invite);
    assert.ok(invite.y + invite.height <= members.y && members.y + members.height <= pending.y && pending.y + pending.height <= help.y, 'Members must keep invitation task, members, pending, and removal help in order');
    assert.equal(await this.disclosure.locator('.invitation-row').count(), 2);
    assert.deepEqual(await this.disclosure.locator('time').evaluateAll(elements => elements.map(element => [element.getAttribute('datetime'), element.textContent])), Array.from({ length: 2 }, () => ['2099-10-26T12:00:00.000Z', '2099-10-26 12:00:00 UTC']));
    assert.deepEqual(await this.disclosure.locator('.invitation-role').evaluateAll(elements => elements.map(element => element.lastChild?.textContent?.trim())), ['User', 'Admin']);
    const styles = await row.getByRole('button').first().evaluate(element => {
      const view = element.ownerDocument.defaultView!;
      const style = view.getComputedStyle(element);
      return { text: style.color, border: style.borderColor, background: style.backgroundColor, surface: view.getComputedStyle(element.closest('details')!).backgroundColor };
    });
    assert.deepEqual(styles, { text: 'rgb(243, 242, 238)', border: 'rgb(123, 126, 136)', background: 'rgba(0, 0, 0, 0)', surface: 'rgb(33, 34, 40)' });
    await this.checkTargets(width);
    await this.screenshot('rows');
    const title = await this.page.locator('body').evaluate(body => {
      const view = body.ownerDocument.defaultView!;
      const sizes = [...body.querySelectorAll('*')].map(element => ({ element, size: Number.parseFloat(view.getComputedStyle(element).fontSize) }));
      for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
      return view.getComputedStyle(body.querySelector('h1')!).fontSize;
    });
    assert.equal(title, '64px');
    await this.checkTargets(width);
    await this.screenshot('text-200');
    const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
    if (evidence !== undefined) await writeFile(join(evidence, `pending-measurements-${this.suffix}.json`), JSON.stringify({ width, shortRow: bounds, styles, text: title }, null, 2));
  }

  async change(action: 'Resend' | 'Revoke', email: string): Promise<void> {
    const button = this.disclosure.getByRole('button', { name: `${action} the invitation to ${email}`, exact: true });
    const form = button.locator('..');
    const token = await form.locator('input[name="csrf_token"]').inputValue();
    assert.notEqual(token, '');
    const organization = await form.locator('input[name="organization_id"]').inputValue();
    const invitation = await form.locator('input[name="invitation_id"]').inputValue();
    await tabTo(this.page, button);
    const [response] = await Promise.all([
      this.page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/invitations/${action.toLowerCase()}`)),
      this.page.waitForNavigation(), this.page.keyboard.press('Enter'),
    ]);
    assert.equal(response.status(), 303);
    assert.equal(response.headers().location, 'https://thermus.example/team/members');
    assert.deepEqual(Object.fromEntries(new URLSearchParams(response.request().postData() ?? '')), { csrf_token: token, organization_id: organization, invitation_id: invitation });
    assert.doesNotMatch(await this.page.getByRole('main').innerText(), /email (?:was )?(?:sent|delivered)/i);
  }

  private async checkTargets(width: number): Promise<void> {
    assert.equal(await this.page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Long pending rows and expanded content must reflow');
    for (const control of await this.disclosure.locator('summary,button').all()) {
      const bounds = await control.boundingBox();
      assert.ok(bounds && bounds.height >= 48 && bounds.width >= 48 && bounds.x >= 0 && bounds.x + bounds.width <= width, 'Pending controls must have 48px targets within the viewport');
    }
  }

  private async screenshot(state: string): Promise<void> {
    const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
    if (evidence === undefined) return;
    await mkdir(evidence, { recursive: true });
    await this.page.screenshot({ path: join(evidence, `pending-${state}-${this.suffix}.png`), fullPage: true });
  }
}
