import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPublicToolFailure } from '../../../script/fetch-url/helper/public-tool-failure.ts';

const details = [
  'HTTP request failed (status unavailable)', 'Renderer readiness timed out', 'DNS lookup timed out',
  'Renderer could not start', ...['ENOENT', 'EACCES', 'ENOEXEC', 'ENOTDIR'].map((code) => `Renderer could not start (${code})`),
  'DNS lookup failed', 'Renderer request timed out', 'Renderer connection failed', 'Renderer TLS failed',
  'Renderer redirect limit exceeded', 'Renderer transfer failed', 'Renderer output limit exceeded',
  'Renderer process was killed', 'Renderer process was interrupted', 'Renderer process failed',
];

test('Given each fixed public failure and every failed HTTP status, when the CLI validates it, then it accepts the exact text', () => {
  for (const message of ['Page processing failed', 'Page fetch failed', 'Server busy. Try again later.', 'Request cancelled', 'Invalid tool arguments', 'Access denied', ...details.map((detail) => `Page fetch failed: ${detail}`)]) {
    assert.equal(isPublicToolFailure(message), true, message);
  }
  for (let status = 400; status <= 599; status += 1) assert.equal(isPublicToolFailure(`Page fetch failed: HTTP ${status}`), true);
});

test('Given private or malformed detail text, when the CLI validates it, then it rejects the entire text', () => {
  for (const message of [
    'Page fetch failed: HTTP 399', 'Page fetch failed: HTTP 600', 'Page fetch failed: HTTP 429.0',
    'Page fetch failed: HTTP 0429', 'Page fetch failed: HTTP 429 PRIVATE', 'Page fetch failed: HTTP 429\n',
    'Page fetch failed: HTTP 429\r', 'Page fetch failed: HTTP 429\u001b[0m', 'Page fetch failed: HTTP 429\0',
    'Page fetch failed: Renderer could not start (EPRIVATE)', 'Page fetch failed: Renderer could not start (ENOENT) PRIVATE',
    'Page fetch failed: DNS lookup timed out\nPRIVATE', 'Page fetch failed: Renderer TLS failed\u001b[0m',
    'Page fetch failed: PRIVATE', 'Page fetch failed: HTTP 429\u2028', 'Page fetch failed: HTTP 429\u2029',
  ]) assert.equal(isPublicToolFailure(message), false, JSON.stringify(message));
});
