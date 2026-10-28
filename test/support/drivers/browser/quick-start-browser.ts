import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { tabTo } from './member-removal-browser.ts';

export class QuickStartBrowser {
  private readonly errors: string[] = [];

  constructor(private readonly page: Page, private readonly evidence?: string) {
    page.on('pageerror', error => this.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') this.errors.push(message.text()); });
  }

  async open() {
    const response = await this.page.goto('https://thermus.example/team/quick-start');
    assert.equal(response?.status(), 200);
    await this.page.getByRole('heading', { name: 'Quick start', exact: true }).waitFor();
  }

  async checkGuideAndLayout() {
    const assets = await this.page.locator('html').evaluate(async element => {
      await element.ownerDocument.fonts.ready;
      const image = element.querySelector('.brand img') as unknown as { naturalWidth: number };
      return { logo: image.naturalWidth > 0, sans: element.ownerDocument.fonts.check('17px "IBM Plex Sans"'), serif: element.ownerDocument.fonts.check('500 32px "IBM Plex Serif"') };
    });
    assert.deepEqual(assets, { logo: true, sans: true, serif: true });
    const links = this.page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link');
    assert.deepEqual(await links.allTextContents(), ['Quick start', 'Connect', 'Switch Workspace', 'Members', 'Audit Log']);
    assert.equal(await links.first().getAttribute('aria-current'), 'page');
    for (const width of [320, 390, 1024]) {
      await this.page.setViewportSize({ width, height: 844 });
      const overflow = await this.page.locator('html').evaluate(element => element.scrollWidth > element.clientWidth);
      assert.equal(overflow, false, `Quick start must fit ${width}px`);
      for (const button of await this.page.getByRole('button').all()) {
        if (await button.isVisible()) {
          const bounds = await button.boundingBox();
          assert.ok(bounds, 'A visible Quick start button must have measurable bounds');
          assert.ok(bounds.height >= 48, 'A Quick start button must have a target at least 48px high');
        }
      }
      if (this.evidence) await this.page.screenshot({ path: `${this.evidence}/quick-start-${width}.png`, fullPage: true });
    }
    await this.openDisclosure('Agent controls and instructions');
    assert.equal(await this.page.getByRole('link', { name: 'Organization capabilities', exact: true }).getAttribute('href'), 'https://claude.ai/admin-settings/capabilities');
    assert.equal(await this.page.getByRole('button', { name: /identity provider/i }).count(), 0);
    assert.match(await this.page.getByRole('main').innerText(), /Planned/);
    assert.match(await this.page.locator('#quick-start-audit-details').innerText(), /no history or replay/);
    await this.openDisclosure('Read or copy the complete guide');
    for (const width of [320, 390, 1024]) {
      await this.page.setViewportSize({ width, height: 844 });
      assert.equal(await this.page.locator('html').evaluate(element => element.scrollWidth > element.clientWidth), false, `Expanded guide must fit ${width}px`);
    }
    if (this.evidence) await this.page.screenshot({ path: `${this.evidence}/quick-start-expanded.png`, fullPage: true });
    await this.toggleDisclosure('Read or copy the complete guide');
  }

  async checkClipboardOutcomes() {
    await this.page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } }));
    await this.copyByKeyboard();
    const manual = this.page.getByRole('textbox', { name: 'Complete guide as Markdown' });
    await manual.waitFor({ state: 'visible' });
    const text = await manual.inputValue();
    assert.match(text, /Claude Code administration/);
    assert.match(text, /Thermus MCP endpoint: https:/);
    assert.match(text, /Identity-provider enrollment — Planned/);
    assert.equal(await this.page.getByRole('button', { name: 'Copied', exact: true }).count(), 0);
    const selected = await manual.evaluate(element => { const field = element as unknown as { selectionEnd: number; selectionStart: number }; return field.selectionEnd - field.selectionStart; });
    assert.equal(selected, text.length);
    await this.page.locator('html').evaluate(element => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { element.dataset.copiedGuide = value; } } }));
    await this.copyByKeyboard();
    await this.page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    assert.equal(await this.page.locator('html').getAttribute('data-copied-guide'), text);
    assert.equal(await this.page.locator('#quick-start-copy-status').innerText(), 'Guide copied to clipboard.');
  }

  async checkManualGuide() {
    await this.openDisclosure('Read or copy the complete guide');
    const text = await this.page.getByRole('textbox', { name: 'Complete guide as Markdown' }).inputValue();
    assert.match(text, /Test saves settings, including the Enable export switch/);
    assert.match(text, /Acme/);
  }

  checkNoBrowserErrors() {
    assert.deepEqual(this.errors, [], 'Quick start must load and copy without console, CSP, or script errors');
  }

  private async openDisclosure(label: string) {
    await this.toggleDisclosure(label);
    const open = await this.page.getByText(label, { exact: true }).evaluate(element => element.parentElement?.hasAttribute('open'));
    assert.ok(open !== undefined, `${label} must belong to a native disclosure`);
    assert.equal(open, true);
  }

  private async toggleDisclosure(label: string) {
    const summary = this.page.getByText(label, { exact: true });
    await tabTo(this.page, summary);
    assert.equal(await summary.evaluate(element => element.matches(':focus')), true);
    await this.page.keyboard.press('Enter');
  }

  private async copyByKeyboard() {
    const button = this.page.getByRole('button', { name: 'Copy guide as Markdown', exact: true });
    await tabTo(this.page, button);
    assert.equal(await button.evaluate(element => element.matches(':focus')), true);
    await this.page.keyboard.press('Enter');
  }
}
