import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { tabTo } from './member-removal-browser.ts';

const membersUrl = 'https://thermus.example/team/members';

export class InvitationBrowser {
  readonly posts: URLSearchParams[] = [];

  constructor(private readonly page: Page, private readonly suffix: string) {
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/team/invitations/send') {
        this.posts.push(new URLSearchParams(request.postData() ?? ''));
      }
    });
  }

  private get disclosure() { return this.page.locator('details.member-invitation'); }
  private get email() { return this.page.getByLabel('Email address', { exact: true }); }
  private get send() { return this.page.getByRole('button', { name: 'Send invitation', exact: true }); }

  async openMembers(): Promise<void> {
    await this.page.goto(membersUrl);
    await this.assertClosed();
  }

  async assertClosed(): Promise<void> {
    assert.equal(await this.disclosure.count(), 1);
    assert.equal(await this.disclosure.getAttribute('open'), null);
    assert.equal(await this.email.isVisible(), false);
    assert.equal(await this.send.isVisible(), false);
  }

  async openByKeyboard(): Promise<void> {
    await tabTo(this.page, this.disclosure.locator('summary'));
    await this.page.keyboard.press('Enter');
    assert.notEqual(await this.disclosure.getAttribute('open'), null);
    assert.equal(await this.email.isVisible(), true);
  }

  async inspectOpenForm(width: number): Promise<void> {
    assert.equal(await this.disclosure.locator('form').count(), 1);
    assert.equal(await this.disclosure.locator('input[type="email"]').count(), 1);
    assert.equal(await this.email.getAttribute('maxlength'), '254');
    assert.equal(await this.page.getByRole('radio', { name: 'User', exact: true }).isChecked(), true);
    assert.equal(await this.page.getByRole('radio', { name: 'Admin', exact: true }).isChecked(), false);
    const policy = this.disclosure.locator('.policy-note');
    assert.equal(await policy.isVisible(), true);
    assert.match(await policy.innerText(), /The sign-in service decides who can accept/);
    const policyBounds = await policy.boundingBox();
    const sendBounds = await this.send.boundingBox();
    const panel = await this.disclosure.locator('.invite-card').boundingBox();
    const main = await this.page.getByRole('main').boundingBox();
    const active = await this.page.getByRole('heading', { name: 'Active members', exact: true }).boundingBox();
    assert.ok(policyBounds && sendBounds && panel && main && active);
    assert.ok(policyBounds.y + policyBounds.height <= sendBounds.y, 'The recipient policy must precede Send invitation');
    assert.ok(panel.y + panel.height <= active.y, 'The invitation form must precede the member list');
    assert.equal(panel.width, main.width, 'The open form must use the full content width');
    for (const control of [this.disclosure.locator('summary'), this.send, this.disclosure.getByRole('link', { name: 'Cancel', exact: true })]) {
      const bounds = await control.boundingBox();
      assert.ok(bounds && bounds.height >= 48 && bounds.width >= 48 && bounds.x >= 0 && bounds.x + bounds.width <= width, 'Invitation controls must have 48px targets inside the viewport');
    }
    const emphasis = await this.disclosure.evaluate(element => {
      const view = element.ownerDocument.defaultView;
      if (view === null) throw new Error('The invitation disclosure has no window');
      const summary = element.querySelector('summary');
      if (summary === null) throw new Error('The invitation disclosure has no summary');
      const orange = [...element.ownerDocument.querySelectorAll('summary,button,a')].filter(control => view.getComputedStyle(control).backgroundColor === 'rgb(232, 85, 42)');
      return { summary: view.getComputedStyle(summary).backgroundColor, orange: orange.map(control => control.textContent) };
    });
    assert.notEqual(emphasis.summary, 'rgb(232, 85, 42)', 'The open disclosure trigger must be neutral');
    assert.deepEqual(emphasis.orange, ['Send invitation']);
    assert.equal(await this.page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    await this.screenshot('open');
  }

  async inspectClosedHeading(width: number): Promise<void> {
    const heading = await this.page.getByRole('heading', { name: 'Members', exact: true }).boundingBox();
    const trigger = await this.disclosure.locator('summary').boundingBox();
    assert.ok(heading && trigger);
    if (width >= 1280) assert.ok(Math.abs(heading.y - trigger.y) < 16, 'Invite member must sit beside the desktop Members heading');
    await this.screenshot('closed');
  }

  async inspectDoubledText(): Promise<void> {
    const geometry = await this.page.locator('body').evaluate(body => {
      const view = body.ownerDocument.defaultView;
      if (view === null) throw new Error('The Members page has no window');
      const sizes = [...body.querySelectorAll('*')].map(element => ({ element, size: Number.parseFloat(view.getComputedStyle(element).fontSize) }));
      for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
      const heading = body.querySelector('h1');
      const trigger = body.querySelector('.member-invitation>summary');
      if (heading === null || trigger === null) throw new Error('Members has no invitation heading');
      const range = body.ownerDocument.createRange();
      range.selectNodeContents(heading);
      const title = range.getBoundingClientRect();
      const summary = trigger.getBoundingClientRect();
      return { overlap: title.left < summary.right && title.right > summary.left && title.top < summary.bottom && title.bottom > summary.top, titleSize: view.getComputedStyle(heading).fontSize };
    });
    assert.equal(geometry.titleSize, '64px');
    assert.equal(geometry.overlap, false, 'The doubled Members title must not overlap Invite member');
    assert.equal(await this.page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'The complete open form must reflow at 200% text');
    await this.screenshot('double-text');
  }

  async cancelDraft(): Promise<void> {
    await this.email.fill('discard@example.com');
    await this.page.getByRole('radio', { name: 'Admin', exact: true }).check();
    const cancel = this.disclosure.getByRole('link', { name: 'Cancel', exact: true });
    await tabTo(this.page, cancel);
    const [response] = await Promise.all([this.page.waitForNavigation(), this.page.keyboard.press('Enter')]);
    assert.equal(response?.request().method(), 'GET');
    assert.equal(this.page.url(), membersUrl);
    await this.assertClosed();
    assert.equal(await this.email.inputValue(), '');
    assert.equal(this.posts.length, 0);
  }

  async rejectInvalidEmail(): Promise<void> {
    await this.email.fill('invalid-email');
    await this.page.getByRole('radio', { name: 'Admin', exact: true }).check();
    await this.send.click();
    assert.equal(await this.email.evaluate(input => (input as unknown as { validity: { typeMismatch: boolean } }).validity.typeMismatch), true);
    assert.equal(await this.email.inputValue(), 'invalid-email');
    assert.equal(await this.page.getByRole('radio', { name: 'Admin', exact: true }).isChecked(), true);
    assert.notEqual(await this.disclosure.getAttribute('open'), null);
    assert.equal(this.posts.length, 0);
    assert.equal(this.page.url(), membersUrl);
  }

  async sendInvitation(email: string, role: 'User' | 'Admin'): Promise<void> {
    await this.email.fill(email);
    await this.page.getByRole('radio', { name: role, exact: true }).check();
    const token = await this.disclosure.locator('input[name="csrf_token"]').inputValue();
    const organization = await this.disclosure.locator('input[name="organization_id"]').inputValue();
    assert.notEqual(token, '');
    const count = this.posts.length;
    await tabTo(this.page, this.send);
    const [response] = await Promise.all([
      this.page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/invitations/send')),
      this.page.waitForNavigation(), this.page.keyboard.press('Enter'),
    ]);
    assert.equal(response.status(), 303);
    assert.equal(response.headers().location, membersUrl);
    assert.equal(this.posts.length, count + 1);
    const post = this.posts[count];
    assert.ok(post);
    assert.deepEqual(Object.fromEntries(post), { csrf_token: token, organization_id: organization, email, role: role.toLowerCase() });
    await this.assertClosed();
    assert.equal(await this.page.getByText(`${email}: ${role} invitation, pending.`, { exact: true }).isVisible(), true);
    assert.doesNotMatch(await this.page.getByRole('main').innerText(), /email (?:was )?(?:sent|delivered)/i);
  }

  async submitForNotice(email: string): Promise<number> {
    await this.email.fill(email);
    await tabTo(this.page, this.send);
    const [response] = await Promise.all([this.page.waitForNavigation(), this.page.keyboard.press('Enter')]);
    assert.ok(response);
    assert.equal(response.request().method(), 'POST');
    assert.equal(this.posts.length, 1);
    assert.equal(await this.page.locator('form,input,details.member-invitation').count(), 0, 'Server notices must not restore a draft or offer a retry form');
    return response.status();
  }

  private async screenshot(state: string): Promise<void> {
    const evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
    if (evidence === undefined) return;
    await mkdir(evidence, { recursive: true });
    await this.page.screenshot({ path: join(evidence, `invitation-${state}-${this.suffix}.png`), fullPage: true });
  }
}
