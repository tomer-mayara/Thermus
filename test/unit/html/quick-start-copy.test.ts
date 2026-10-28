import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { parseHTML } from 'linkedom';
import { quickStartPage } from '../../../src/interfaces/web/account/quick-start-page.ts';

for (const outcome of ['success', 'denied', 'unavailable'] as const) {
  test(`Given clipboard ${outcome}, when the Admin copies, then success is reported only after a completed write and other outcomes show selected manual text`, async () => {
    const { document, window } = parseHTML(await quickStartPage({ organizationName: 'Acme', publicBaseUrl: 'https://thermus.example/', mcpResourceUrl: 'https://thermus.example/mcp' }).text());
    let copied: string | undefined;
    let selected = false;
    const textarea = document.querySelector('textarea');
    assert.ok(textarea, 'Quick start must provide a manual copy field');
    Object.assign(textarea, { select: () => { selected = true; } });
    const navigator = outcome === 'unavailable' ? {} : { clipboard: { writeText: async (text: string) => { if (outcome === 'denied') throw new Error('Denied'); copied = text; } } };
    const script = document.querySelector('script')?.textContent;
    assert.ok(script, 'Quick start must include its clipboard script');
    runInNewContext(script, { document, navigator, setTimeout: () => 0, clearTimeout: () => {} });
    const button = document.querySelector('#quick-start-copy');
    assert.ok(button, 'Quick start must provide the copy button');
    const label = button.querySelector('[data-copy-label]');
    assert.ok(label, 'The copy button must have a status label');
    assert.equal(button.hasAttribute('hidden'), false);
    button.dispatchEvent(new window.Event('click'));
    assert.notEqual(label.textContent, 'Copied');
    await setImmediate();
    if (outcome === 'success') {
      assert.equal(copied, textarea.textContent);
      assert.equal(label.textContent, 'Copied');
      assert.equal(document.querySelector('#quick-start-copy-status')?.textContent, 'Guide copied to clipboard.');
      assert.equal(selected, false);
    } else {
      assert.equal(label.textContent, 'Copy guide as Markdown');
      assert.equal(document.querySelector('#quick-start-manual')?.hasAttribute('open'), true);
      assert.equal(selected, true);
      assert.match(document.querySelector('#quick-start-copy-status')?.textContent ?? '', /Select and copy/);
    }
  });
}
