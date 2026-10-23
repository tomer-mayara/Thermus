import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggingForm } from '../../../src/interfaces/web/account/logging-form.ts';

function validForm(): URLSearchParams {
  return new URLSearchParams({ csrf_token: 'csrf', organization_id: 'tenant:a', expected_revision: '', endpoint: 'https://collector.example/v1/logs', auth: 'none', token: '' });
}

test('Given an absent or checked native checkbox, when a valid Logging form is read, then enabled is false or true', () => {
  for (const enabled of [false, true]) {
    const form = validForm();
    if (enabled) form.append('enabled', 'on');
    const result = loggingForm(form, 'csrf');
    assert.notEqual(typeof result, 'string');
    if (typeof result !== 'string') assert.equal(result.enabled, enabled);
  }
});
test('Given a duplicate or invalid checkbox, when Logging reads the form, then the form is refused', () => {
  for (const values of [['on', 'on'], ['off'], ['']]) {
    const form = validForm();
    for (const value of values) form.append('enabled', value);
    assert.equal(loggingForm(form, 'csrf'), 'invalidRequest');
  }
});
test('Given invalid CSRF and invalid fields, when Logging reads the form, then the forged request takes precedence', () => {
  const form = validForm();
  form.set('csrf_token', 'wrong'); form.append('enabled', 'off'); form.append('unknown', 'value'); form.delete('auth');
  assert.equal(loggingForm(form, 'csrf'), 'forgedRequest');
});
test('Given unknown, missing or duplicate fields, when Logging reads a valid CSRF token, then the form is refused', () => {
  for (const change of [(form: URLSearchParams) => form.append('unknown', 'value'), (form: URLSearchParams) => form.delete('token'), (form: URLSearchParams) => form.append('auth', 'bearer')]) {
    const form = validForm(); change(form);
    assert.equal(loggingForm(form, 'csrf'), 'invalidRequest');
  }
});
