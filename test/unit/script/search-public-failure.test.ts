import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPublicToolFailure } from '../../../script/search/helper/public-tool-failure.ts';

const details = [
  'HTTP request failed (status unavailable)', 'Renderer readiness timed out', 'DNS lookup timed out',
  'Renderer could not start', ...['ENOENT', 'EACCES', 'ENOEXEC', 'ENOTDIR'].map((code) => `Renderer could not start (${code})`),
  'DNS lookup failed', 'Renderer request timed out', 'Renderer connection failed', 'Renderer TLS failed',
  'Renderer redirect limit exceeded', 'Renderer transfer failed', 'Renderer output limit exceeded',
  'Renderer process was killed', 'Renderer process was interrupted', 'Renderer process failed',
];

test('Given fixed search failures and HTTP failures, when the CLI checks them, then it accepts exact public text', () => {
  for (const message of ['Search content withheld', 'Search processing failed', 'Search failed', 'Server busy. Try again later.', 'Request cancelled', 'Invalid tool arguments', 'Access denied', ...details.map((detail) => `Search failed: ${detail}`)]) {
    assert.equal(isPublicToolFailure(message), true, message);
  }
  for (let status = 400; status <= 599; status += 1) assert.equal(isPublicToolFailure(`Search failed: HTTP ${status}`), true);
});

test('Given private or malformed failure text, when the CLI checks it, then it refuses the entire text', () => {
  for (const message of [
    'Page fetch failed', 'Search failed: HTTP 399', 'Search failed: HTTP 600', 'Search failed: HTTP 0429',
    'Search failed: HTTP 429 PRIVATE', 'Search failed: HTTP 429\n', 'Search failed: HTTP 429\r',
    'Search failed: HTTP 429\u001b[0m', 'Search failed: HTTP 429\0', 'Search failed: HTTP 429\u2028',
    'Search failed: Renderer could not start (PRIVATE)', 'Search failed: DNS lookup failed\nPRIVATE',
    'Search content withheld: PRIVATE', 'Search failed: PRIVATE',
  ]) assert.equal(isPublicToolFailure(message), false, JSON.stringify(message));
});
