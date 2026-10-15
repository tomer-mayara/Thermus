import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertProviderMfaProfile, hostedMfaPolicy } from '../../support/hosted-live/mfa-profile.ts';

test('Given no live MFA profile, when the gate selects its policy, then Optional is the safe default', () => {
  assert.equal(hostedMfaPolicy(undefined), 'optional');
  assert.equal(hostedMfaPolicy('optional'), 'optional');
  assert.equal(hostedMfaPolicy('required'), 'required');
});

test('Given an invalid live MFA profile, when the gate selects its policy, then it refuses the setting without repeating the value', () => {
  for (const value of ['', 'off', 'Required', 'secret-value']) {
    assert.throws(() => hostedMfaPolicy(value), { message: 'WORKOS_MFA_POLICY must be optional or required.' });
  }
});

for (const policy of ['optional', 'required'] as const) {
  test(`Given the ${policy} live profile, when the provider settings match, then its preflight accepts them`, () => {
    assert.doesNotThrow(() => assertProviderMfaProfile(policy, { mfaEnabled: true, mfaRequired: policy === 'required' }));
  });

  test(`Given the ${policy} live profile, when MFA is Off, absent, or another profile, then its preflight refuses before sign-in`, () => {
    for (const settings of [{ mfaEnabled: false, mfaRequired: false }, {}, { mfaEnabled: true, mfaRequired: policy !== 'required' }]) {
      assert.throws(() => assertProviderMfaProfile(policy, settings), /provider MFA settings do not match/);
    }
  });
}
