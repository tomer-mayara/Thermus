import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { quickStartPage } from '../../../src/interfaces/web/account/quick-start-page.ts';

const options = { organizationName: 'Acme', publicBaseUrl: 'https://thermus.example/team/', mcpResourceUrl: 'https://mcp.thermus.example/team/mcp' };

test('Given an Admin guide, when it renders, then all provider links and setup instructions are included in selectable complete Markdown', async () => {
  const { document } = parseHTML(await quickStartPage(options).text());
  const guide = document.querySelector('textarea')?.textContent ?? '';
  assert.match(guide, /# Thermus Quick start — Acme/);
  assert.match(guide, /Thermus MCP endpoint: https:\/\/mcp.thermus.example\/team\/mcp/);
  assert.match(guide, /Test saves settings, including the Enable export switch/);
  assert.match(guide, /Identity-provider enrollment — Planned/);
  assert.match(guide, /Enabling SSO alone does not establish automatic enrollment/);
  for (const link of document.querySelectorAll('.quick-start-providers a')) {
    const href = link.getAttribute('href');
    assert.ok(href, `${link.textContent} must have a destination`);
    assert.ok(guide.includes(href), `Complete Markdown includes ${link.textContent}`);
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  }
  assert.equal(document.querySelector('textarea')?.hasAttribute('readonly'), true);
  assert.equal(document.querySelector('textarea')?.closest('details')?.hasAttribute('hidden'), false);
  assert.equal(document.querySelector('a.quick-start-invite')?.getAttribute('href'), 'https://thermus.example/team/members');
});

test('Given arbitrary organization text, when rendered or copied, then HTML and Markdown preserve it as text without injected elements or sections', async () => {
  const name = 'A [click](javascript:alert(1)) <img src=x onerror=alert(1)>\n# Other **org** &copy; \\';
  const { document } = parseHTML(await quickStartPage({ ...options, organizationName: name }).text());
  assert.equal(document.querySelector('.workspace-name')?.textContent, name);
  assert.equal(document.querySelector('.workspace-context img'), null);
  assert.equal(document.querySelectorAll('script').length, 1);
  const guide = document.querySelector('textarea')?.textContent ?? '';
  assert.doesNotMatch(guide, /\n# Other/);
  assert.match(guide, /A \\\[click\\\]\\\(javascript:alert\\\(1\\\)\\\)/);
  assert.doesNotMatch(guide, /<img/);
});

test('Given audit setup guidance, when the Admin reads the setup sequence, then switch effects, recovery, and delivery limits are visible outside disclosures and the copy field', async () => {
  const { document } = parseHTML(await quickStartPage(options).text());
  const details = document.querySelector('#quick-start-audit-details');
  assert.ok(details);
  assert.equal(details.closest('details'), null);
  assert.equal(details.hasAttribute('hidden'), false);
  assert.match(details.textContent ?? '', /Either Save or Test can enable or disable export/);
  assert.match(details.textContent ?? '', /Failed Test does not undo saved settings/);
  assert.match(details.textContent ?? '', /events can be lost or duplicated, with no history or replay/);
  assert.equal(details.querySelector('a')?.getAttribute('href'), 'https://thermus.example/team/logging');
  assert.equal(details.querySelector('textarea'), null);
});

test('Given page assets and copy behavior, when CSP is returned, then local fonts/logo and exact script and scoped style hashes are allowed without inline escape hatches', async () => {
  const response = quickStartPage(options);
  const { document } = parseHTML(await response.text());
  const csp = response.headers.get('Content-Security-Policy');
  assert.ok(csp, 'Quick start must return a content security policy');
  for (const element of document.querySelectorAll('script, style')) {
    assert.ok(csp.includes(`'sha256-${createHash('sha256').update(element.textContent ?? '').digest('base64')}'`));
  }
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /font-src 'self'/);
  assert.equal(document.querySelector('.brand img')?.getAttribute('src'), '/assets/thermus-logo.svg');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('Given configured absolute URLs with unsafe protocols or credentials, when guide rendering is requested, then it refuses active or credential-bearing destinations', () => {
  for (const publicBaseUrl of ['javascript:alert(1)', '/relative', 'https://token@thermus.example/team/']) {
    assert.throws(() => quickStartPage({ ...options, publicBaseUrl }));
  }
  assert.throws(() => quickStartPage({ ...options, mcpResourceUrl: 'data:text/html,hi' }));
});
