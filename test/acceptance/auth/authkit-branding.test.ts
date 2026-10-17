import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

function read(name: string): string {
  return readFileSync(new URL(`docs/design/authkit/${name}`, repositoryRoot), 'utf8');
}

interface CssElement { css: string }
type ElementStyles = Record<string, CssElement> & { authkitInput: CssElement; authkitLabel: CssElement };
interface BrandingFields {
  theme: string;
  authkitSignInLayout: string;
  authkitSignInContentPanelAlignment: string;
  authkitSignInContentPanelHiddenOnMobile: boolean;
  authkitSignInHeadingText: string;
  font: { family: string };
}

test('Given the approved design, when the hosted panel is prepared, then it has the exact copy and four directed flows', () => {
  const html = read('panel.html');
  const document = parseHTML(html).document;
  const panelText = document.querySelector('.thermus-brand-panel')?.textContent?.replace(/\s+/g, ' ') ?? '';
  for (const text of [
    'MCP GATEWAY FOR AGENT WEB ACCESS',
    'Protect against prompt injection and data leaks from AI agents',
    'Security for organizations that are deploying organization-wide AI tools that give employees the ability to create agents.',
    'Your agents', 'Thermus', 'The web', 'Request + reason', 'Approved', 'Raw pages', 'Clean',
  ]) assert.ok(panelText.includes(text), text);
  assert.equal((html.match(/class="thermus-flow-node/g) ?? []).length, 3);
  assert.equal((html.match(/class="thermus-flow-arrow /g) ?? []).length, 4);
  assert.match(html, /aria-label="Your agents send a request and reason to Thermus\. Thermus sends the approved request to the web\. Raw pages return from the web to Thermus\. Clean content returns from Thermus to your agents\."/);
  assert.doesNotMatch(html, /<(?:script|iframe|form|object|style|svg)\b|\son\w+=/i);
  const css = read('panel.css');
  assert.match(css, /\.thermus-flow-arrow--return[\s\S]*?left: 0/);
  assert.match(css, /\.thermus-flow-arrow--raw[\s\S]*?border-top-style: dashed/);
  assert.match(css, /\.thermus-flow-label\s*\{[^}]*white-space: nowrap/);
});

test('Given WorkOS embeds element styles literally, when a style is prepared, then it uses a complete CSS rule', () => {
  const elements = JSON.parse(read('element-styles.json')) as ElementStyles;
  for (const { css } of Object.values(elements)) {
    assert.match(css, /^\.ak-[A-Za-z]+[^{}]*\{/);
    assert.ok(css.trim().endsWith('}'));
  }
  assert.match(elements.authkitInput.css, /\.ak-TextField\s*\{/);
  assert.match(elements.authkitLabel.css, /\.ak-Label\s*\{/);
});

test('Given a branding update, when its fields are prepared, then authentication and redirect settings are absent', () => {
  const fields = JSON.parse(read('branding-fields.json')) as BrandingFields;
  assert.equal(fields.theme, 'Dark');
  assert.equal(fields.authkitSignInLayout, 'TwoColumn');
  assert.equal(fields.authkitSignInContentPanelAlignment, 'Left');
  assert.equal(fields.authkitSignInContentPanelHiddenOnMobile, true);
  assert.equal(fields.authkitSignInHeadingText, 'Sign in to Thermus');
  assert.equal(fields.font.family, 'IBM Plex Sans');
  assert.doesNotMatch(JSON.stringify(fields), /redirect|password|authenticationMethods|resetCss|environmentId|app_branding_/i);
});
