import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { validateSignupDocuments } from '../../../src/accounts/providers/workos/workos-signup-documents.ts';
import { loadSelfServeSignupEnabled } from '../../../src/accounts/providers/workos/workos-signup-settings.ts';

function document(text: string) {
  return { version: 'test-1', text, sha256: createHash('sha256').update(text, 'utf8').digest('hex') };
}

test('Given signup settings, when loaded, then only exact true enables signup and invalid values fail', () => {
  assert.equal(loadSelfServeSignupEnabled({}), false);
  assert.equal(loadSelfServeSignupEnabled({ SELF_SERVE_SIGNUP_ENABLED: 'false' }), false);
  assert.equal(loadSelfServeSignupEnabled({ SELF_SERVE_SIGNUP_ENABLED: 'true' }), true);
  for (const value of ['', 'True', ' true', '1']) assert.throws(() => loadSelfServeSignupEnabled({ SELF_SERVE_SIGNUP_ENABLED: value }));
});

test('Given exact test documents, when validated, then a frozen copy retains their exact UTF-8 text', () => {
  const input = { version: 'bundle-1', terms: document('Terms é\r\n'), notice: document('Notice'), agreement: { version: 'statement-1', text: 'I agree for business use as an adult.' } };
  const bundle = validateSignupDocuments(input);
  assert.deepEqual(bundle, input);
  assert.ok(Object.isFrozen(bundle.terms));
  input.terms.text = 'changed';
  assert.equal(bundle.terms.text, 'Terms é\r\n');
});

test('Given altered bytes or invalid versions, when documents are validated, then validation fails', () => {
  const input = { version: 'bundle-1', terms: document('Terms'), notice: document('Notice'), agreement: { version: 'statement-1', text: 'I agree.' } };
  assert.throws(() => validateSignupDocuments({ ...input, terms: { ...input.terms, text: 'Terms\n' } }));
  assert.throws(() => validateSignupDocuments({ ...input, version: '' }));
  assert.throws(() => validateSignupDocuments({ ...input, notice: { ...input.notice, sha256: input.notice.sha256.toUpperCase() } }));
});
