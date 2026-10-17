import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signupAgreementIn } from '../../../src/auth/hosted-auth/workos/workos-signup-form.ts';

test('Given an express agreement form, when its exact fields and current version match, then it is accepted', () => {
  assert.equal(signupAgreementIn(new URLSearchParams({ csrf_token: 'secret', document_version: 'v1', agreement: 'accepted' }), 'secret', 'v1'), 'accepted');
});

test('Given unchecked, stale, forged, repeated, or extra fields, when parsed, then the form is refused', () => {
  for (const body of ['csrf_token=secret&document_version=v1', 'csrf_token=secret&document_version=old&agreement=accepted',
    'csrf_token=wrong&document_version=v1&agreement=accepted', 'csrf_token=secret&document_version=v1&agreement=accepted&agreement=accepted',
    'csrf_token=secret&document_version=v1&agreement=accepted&subject=user', 'csrf_token=secret&document_version=v1&agreement=false']) {
    assert.notEqual(signupAgreementIn(new URLSearchParams(body), 'secret', 'v1'), 'accepted');
  }
});
