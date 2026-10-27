import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { tabTo } from './member-removal-browser.ts';

export class WorkspaceSelectionBrowser {
  constructor(private readonly page: Page, private readonly options: { readonly javaScriptEnabled: boolean; readonly width: number }) {}

  async openPicker(): Promise<void> {
    if (!this.options.javaScriptEnabled) {
      await this.page.goto('https://thermus.example/organizations');
      return;
    }
    await this.page.goto('https://thermus.example/');
    const switchLink = this.page.getByRole('link', { name: 'Switch Workspace', exact: true });
    await switchLink.waitFor();
    await tabTo(this.page, switchLink);
    await Promise.all([this.page.waitForNavigation(), this.page.keyboard.press('Enter')]);
  }

  async inspectPicker(admin: boolean): Promise<void> {
    const navigation = this.page.getByRole('banner').getByRole('navigation', { name: 'Workspace', exact: true });
    const labels = admin ? ['Connect', 'Switch Workspace', 'Members', 'Audit Log'] : ['Connect', 'Switch Workspace'];
    assert.deepEqual(await navigation.getByRole('link').allTextContents(), labels);
    assert.deepEqual(await navigation.locator('[aria-current="page"]').allTextContents(), ['Switch Workspace']);
    assert.equal(await this.page.getByRole('navigation', { name: 'Workspace', exact: true }).count(), 1);
    await this.page.getByRole('link', { name: 'Skip to content', exact: true }).focus();
    await this.page.keyboard.press('Enter');
    assert.equal(await this.page.getByRole('main').evaluate(element => element.matches(':focus')), true);
    for (const name of labels) {
      const link = navigation.getByRole('link', { name, exact: true });
      await tabTo(this.page, link);
      const facts = await link.evaluate(element => {
        const view = element.ownerDocument.defaultView;
        if (view === null) throw new Error('The picker link has no browser window');
        const style = view.getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return { size: style.fontSize, background: style.backgroundColor, border: style.borderBottomColor, borderWidth: style.borderBottomWidth, outline: style.outlineWidth, height: bounds.height, width: bounds.width, x: bounds.x };
      });
      assert.equal(facts.size, '15px');
      assert.equal(facts.background, 'rgba(0, 0, 0, 0)');
      assert.equal(facts.borderWidth, '2px');
      assert.equal(facts.border, name === 'Switch Workspace' ? 'rgb(232, 85, 42)' : 'rgba(0, 0, 0, 0)');
      assert.equal(facts.outline, '3px');
      assert.ok(facts.height >= 48 && facts.width >= 48 && facts.x >= 0 && facts.x + facts.width <= this.options.width, 'Picker links must retain visible 48px targets');
    }
    assert.equal(await this.page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    const directory = process.env.THERMUS_BROWSER_EVIDENCE_DIR;
    if (directory !== undefined) {
      await mkdir(directory, { recursive: true });
      await this.page.screenshot({ path: join(directory, `picker-${admin ? 'admin' : 'user'}-${this.options.javaScriptEnabled ? 'on' : 'off'}-${this.options.width}.png`), fullPage: true });
    }
  }

  async chooseOrganization(label: string): Promise<void> {
    const posts: string[] = [];
    this.page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
    await tabTo(this.page, this.page.getByRole('button', { name: label, exact: true }));
    await Promise.all([this.page.waitForNavigation(), this.page.keyboard.press('Enter')]);
    assert.equal(new URL(this.page.url()).pathname, '/', 'The actual organization button must leave the picker for Connect');
    const name = label.replace(' (selected)', '');
    if (this.options.javaScriptEnabled) await this.page.getByText(`Workspace: ${name}`, { exact: true }).waitFor({ state: 'visible' });
    await this.openPicker();
    assert.equal(await this.page.getByRole('button', { name: `${name} (selected)`, exact: true }).isVisible(), true);
    assert.deepEqual(posts, ['/organizations/select'], 'One organization choice must send one protected POST');
  }
}
