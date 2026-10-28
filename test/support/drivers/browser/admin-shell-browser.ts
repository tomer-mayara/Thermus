import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { adminShellMeasurements } from './admin-shell-measurements.ts';
import { tabTo } from './member-removal-browser.ts';

export class AdminShellBrowser {
  private readonly evidence = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
  private readonly suffix: string;

  constructor(private readonly page: Page, private readonly options: { readonly javaScriptEnabled: boolean; readonly width: number }) {
    this.suffix = `${options.javaScriptEnabled ? 'on' : 'off'}-${options.width}`;
  }

  async inspectMembers(organizationName: string): Promise<void> {
    await this.page.locator('html').evaluate(element => element.ownerDocument.fonts.ready);
    await this.screenshot(`members-layout-${this.suffix}.png`);
    const skipLink = this.page.getByRole('link', { name: 'Skip to content', exact: true });
    await this.page.keyboard.press('Tab');
    assert.equal(await skipLink.evaluate(element => element.matches(':focus')), true);
    const measurements = await adminShellMeasurements(this.page, this.options);
    assert.ok(Math.abs(measurements.main.width - measurements.list.width) <= 1, 'The member list must use the full available content width');
    assert.equal(measurements.title.size, '32px', 'The shared page title must stay at 32px');
    assert.match(measurements.title.family, /IBM Plex Serif/);
    assert.equal(measurements.text.sansLoaded, true);
    assert.equal(measurements.text.serifLoaded, true);
    assert.deepEqual(measurements.focus, { outline: '3px', outlineColor: 'rgb(243, 242, 238)', text: 'rgb(23, 24, 29)', background: 'rgb(243, 242, 238)' });
    await this.writeMeasurements(measurements);
    const banner = this.page.getByRole('banner');
    assert.equal(await banner.getByText(organizationName, { exact: true }).isVisible(), true);
    assert.equal(await banner.locator('.workspace-context a').count(), 0);
    assert.deepEqual(await banner.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link').allTextContents(), ['Quick start', 'Connect', 'Switch Workspace', 'Members', 'Audit Log']);
    await this.checkReflow('Long workspace and member values must fit');
    const bounds = await skipLink.boundingBox();
    assert.ok(bounds, 'The focused skip link must be visible');
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= this.options.width);
    await this.page.keyboard.press('Enter');
    assert.equal(await this.page.getByRole('main').evaluate(element => element.matches(':focus')), true, 'Skip to content must move focus into main');
    await this.checkTargets('link', ['Quick start', 'Connect', 'Switch Workspace', 'Members', 'Audit Log']);
    const invitation = this.page.locator('details.member-invitation');
    assert.equal(await invitation.getAttribute('open'), null);
    assert.equal(await invitation.getByRole('button', { name: 'Send invitation', exact: true }).isVisible(), false);
    const trigger = await invitation.locator('summary').boundingBox();
    assert.ok(trigger && trigger.height >= 48 && trigger.width >= 48 && trigger.x >= 0 && trigger.x + trigger.width <= this.options.width, 'Invite member must have a visible 48px target');
  }

  async expandMembersHelpWithDoubleText(): Promise<void> {
    const help = this.page.locator('details[data-help="members"]');
    await tabTo(this.page, help.locator('summary'));
    await this.page.keyboard.press('Enter');
    assert.notEqual(await help.getAttribute('open'), null);
    assert.match(await help.innerText(), /Do not submit another\s+removal/);
    const titleSize = await this.page.locator('body').evaluate(body => {
      const view = body.ownerDocument.defaultView;
      if (view === null) throw new Error('The page body has no browser window');
      const sizes = [...body.querySelectorAll('*')].map(element => ({ element, size: Number.parseFloat(view.getComputedStyle(element).fontSize) }));
      for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
      const title = body.querySelector('h1');
      if (title === null) throw new Error('The Members page has no title');
      return view.getComputedStyle(title).fontSize;
    });
    assert.equal(titleSize, '64px', 'Text must be increased to 200% for reflow checks');
    await this.checkReflow('Expanded help and doubled text must reflow without horizontal scrolling');
    await this.screenshot(`members-expanded-text-200-${this.suffix}.png`);
  }

  async openAudit(organizationName: string): Promise<void> {
    await this.page.goto('https://thermus.example/team/members');
    await this.navigateTo('Audit Log');
    assert.equal(await this.page.getByRole('heading', { name: 'Audit logs', exact: true }).isVisible(), true);
    assert.equal(await this.page.getByRole('banner').getByText(organizationName, { exact: true }).count(), 0, 'Audit must keep its existing context without a workspace-name lookup');
  }

  async inspectAuditControls(): Promise<void> {
    assert.equal(await this.page.getByRole('button', { name: 'Save', exact: true }).isVisible(), true);
    assert.equal(await this.page.getByRole('button', { name: 'Test', exact: true }).isVisible(), true);
    assert.equal(await this.page.getByLabel('OTLP logs endpoint', { exact: true }).isVisible(), true);
    assert.equal(await this.page.getByLabel('Bearer token', { exact: true }).isVisible(), true);
    assert.equal(await this.page.getByRole('switch', { name: 'Enable export' }).isVisible(), true);
    const dataset = this.page.getByLabel('Axiom dataset', { exact: true });
    assert.equal(await dataset.isVisible(), !this.options.javaScriptEnabled);
    await this.page.getByRole('radio', { name: 'Axiom', exact: true }).check();
    assert.equal(await dataset.isVisible(), true);
    await this.page.getByRole('radio', { name: 'Custom', exact: true }).check();
    assert.equal(await dataset.isVisible(), !this.options.javaScriptEnabled);
    await this.checkTargets('button', ['Save', 'Test']);
    await this.checkReflow('Audit controls must fit');
    const help = this.page.locator('details[data-help="audit"]');
    await tabTo(this.page, help.locator('summary'));
    await this.page.keyboard.press('Enter');
    assert.notEqual(await help.getAttribute('open'), null);
    await this.checkReflow('Expanded Audit help must fit with its controls');
    await this.screenshot(`audit-controls-${this.suffix}.png`);
  }

  recordWrites(): string[] {
    const posts: string[] = [];
    this.page.on('request', request => {
      if (request.method() === 'POST') posts.push(new URL(request.url()).pathname);
    });
    return posts;
  }

  async saveDestination(): Promise<void> {
    await this.page.getByLabel('OTLP logs endpoint', { exact: true }).fill('https://collector.example/v1/logs');
    await this.page.getByLabel('Bearer token', { exact: true }).fill('browser-test-token');
    await tabTo(this.page, this.page.getByRole('button', { name: 'Save', exact: true }));
    await Promise.all([this.page.waitForNavigation(), this.page.keyboard.press('Enter')]);
    assert.equal(await this.page.locator('#logging-saved').innerText(), 'saved');
    assert.equal(await this.page.getByLabel('Bearer token', { exact: true }).inputValue(), '');
  }

  async testDestination(): Promise<void> {
    await tabTo(this.page, this.page.getByRole('button', { name: 'Test', exact: true }));
    await Promise.all([this.page.waitForNavigation(), this.page.keyboard.press('Enter')]);
    assert.equal(await this.page.getByRole('heading', { name: 'Test accepted', exact: true }).isVisible(), true);
    assert.equal(await this.page.getByText('Settings saved. Destination accepted the Test event.', { exact: true }).isVisible(), true);
    assert.equal(await this.page.getByRole('button', { name: 'Save', exact: true }).isVisible(), true);
  }

  async returnToMembers(organizationName: string): Promise<void> {
    await this.navigateTo('Members');
    assert.equal(await this.page.getByRole('banner').getByText(organizationName, { exact: true }).isVisible(), true);
  }

  async inspectConnect(admin: boolean): Promise<void> {
    await this.page.goto('https://thermus.example/');
    const navigation = this.page.getByRole('banner').getByRole('navigation', { name: 'Workspace', exact: true });
    await navigation.waitFor();
    await this.page.locator('html').evaluate(element => element.ownerDocument.fonts.ready);
    const labels = admin ? ['Quick start', 'Connect', 'Switch Workspace', 'Members', 'Audit Log'] : ['Connect', 'Switch Workspace'];
    assert.equal(await this.page.getByRole('navigation', { name: 'Workspace', exact: true }).count(), 1);
    assert.equal(await this.page.getByRole('main').getByRole('navigation').count(), 0);
    assert.deepEqual(await navigation.getByRole('link').allTextContents(), labels);
    assert.deepEqual(await navigation.locator('[aria-current]').allTextContents(), ['Connect']);
    assert.deepEqual(await navigation.getByRole('link').evaluateAll(links => links.map(link => {
      const view = link.ownerDocument.defaultView;
      if (view === null) throw new Error('The navigation has no browser window');
      const style = view.getComputedStyle(link);
      return { size: style.fontSize, background: style.backgroundColor, border: style.borderBottomColor, borderWidth: style.borderBottomWidth };
    })), labels.map(label => ({ size: '15px', background: 'rgba(0, 0, 0, 0)', border: label === 'Connect' ? 'rgb(232, 85, 42)' : 'rgba(0, 0, 0, 0)', borderWidth: '2px' })));
    await this.checkTargets('link', labels);
    for (const name of labels) {
      const link = navigation.getByRole('link', { name, exact: true });
      await tabTo(this.page, link);
      assert.equal(await link.evaluate(element => element.ownerDocument.defaultView?.getComputedStyle(element).outlineWidth), '3px');
    }
    await this.checkReflow('Connect navigation must fit without horizontal scrolling');
    await this.screenshot(`connect-${admin ? 'admin' : 'user'}-${this.suffix}.png`);
    await tabTo(this.page, navigation.getByRole('link', { name: 'Switch Workspace', exact: true }));
    await Promise.all([this.page.waitForNavigation(), this.page.keyboard.press('Enter')]);
    assert.equal(new URL(this.page.url()).pathname, '/organizations');
  }

  private async navigateTo(name: string): Promise<void> {
    await tabTo(this.page, this.page.getByRole('banner').getByRole('link', { name, exact: true }));
    await Promise.all([this.page.waitForNavigation(), this.page.keyboard.press('Enter')]);
    assert.equal(await this.page.locator('header [aria-current="page"]').innerText(), name);
  }

  private async checkTargets(role: 'button' | 'link', labels: readonly string[]): Promise<void> {
    for (const name of labels) {
      const bounds = await this.page.getByRole(role, { name, exact: true }).boundingBox();
      assert.ok(bounds, `${name} must be visible`);
      assert.ok(bounds.height >= 48 && bounds.width >= 48 && bounds.x >= 0 && bounds.x + bounds.width <= this.options.width, `${name} must have a visible 48px target`);
    }
  }

  private async checkReflow(message: string): Promise<void> {
    assert.equal(await this.page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true, message);
  }

  private async screenshot(name: string): Promise<void> {
    if (this.evidence === undefined) return;
    await mkdir(this.evidence, { recursive: true });
    await this.page.screenshot({ path: join(this.evidence, name), fullPage: true });
  }

  private async writeMeasurements(measurements: Awaited<ReturnType<typeof adminShellMeasurements>>): Promise<void> {
    if (this.evidence === undefined) return;
    await mkdir(this.evidence, { recursive: true });
    await writeFile(join(this.evidence, `measurements-${this.suffix}.json`), JSON.stringify(measurements, null, 2));
  }
}
