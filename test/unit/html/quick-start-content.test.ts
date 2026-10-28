import assert from 'node:assert/strict';
import { test } from 'node:test';
import { micromark } from 'micromark';
import { parseHTML } from 'linkedom';
import { quickStartContent } from '../../../src/interfaces/web/account/quick-start-content.ts';

test('Given organization text with Markdown syntax, entities, and line breaks, when the copied Markdown is rendered, then it remains one plain heading with the original single-line text', () => {
  const organizationName = 'Acme &copy; [link](https://evil.example) **bold** <img>\n# injected';
  const { markdown } = quickStartContent({ organizationName, publicBaseUrl: 'https://thermus.example/team/', mcpResourceUrl: 'https://thermus.example/mcp' });
  const { document } = parseHTML(micromark(markdown));
  assert.equal(document.querySelector('h1')?.textContent, `Thermus Quick start — ${organizationName.replace('\n', ' ')}`);
  assert.equal(document.querySelectorAll('h1').length, 1);
  assert.equal(document.querySelector('h1 a, h1 strong, h1 img'), null);
});

test('Given configured URLs under a path with parentheses, when the copied guide is rendered, then internal links remain complete absolute configured destinations', () => {
  const { markdown, navigation } = quickStartContent({ organizationName: 'Acme', publicBaseUrl: 'https://thermus.example/team(acme)', mcpResourceUrl: 'https://mcp.example/org/mcp' });
  const { document } = parseHTML(micromark(markdown));
  assert.equal(document.querySelector('a[href*="logging"]')?.getAttribute('href'), 'https://thermus.example/team%28acme%29/logging');
  assert.equal(navigation.product, 'https://thermus.example/team(acme)/');
});
