import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggingForm } from '../../../src/interfaces/web/account/logging-form.ts';

function validForm(): URLSearchParams {
  return new URLSearchParams({ csrf_token: 'csrf', organization_id: 'tenant:a', expected_revision: '', endpoint: 'https://collector.example/v1/logs', destination: 'custom', auth: 'bearer', token: '' });
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

test('Given an explicit Axiom destination, when the form is read, then a valid dataset is required', () => {
  for (const dataset of [undefined, '', 'invalid_dataset', 'a'.repeat(129), 'audit-log-test']) {
    const form = validForm(); form.set('destination', 'axiom');
    if (dataset !== undefined) form.set('axiom_dataset', dataset);
    const result = loggingForm(form, 'csrf');
    if (dataset === 'audit-log-test') {
      assert.notEqual(typeof result, 'string');
      if (typeof result !== 'string') assert.equal(result.axiomDataset, dataset);
    } else assert.equal(result, 'invalidRequest');
  }
});
test('Given Custom with a dataset or a missing, duplicate or unknown destination, when the form is read, then it is refused', () => {
  for (const change of [
    (form: URLSearchParams) => form.set('axiom_dataset', 'audit-log-test'),
    (form: URLSearchParams) => form.delete('destination'),
    (form: URLSearchParams) => form.set('destination', 'unknown'),
    (form: URLSearchParams) => form.set('destination', ''),
    (form: URLSearchParams) => form.append('destination', 'custom'),
    (form: URLSearchParams) => form.set('auth', 'none'),
  ]) {
    const form = validForm(); change(form);
    assert.equal(loggingForm(form, 'csrf'), 'invalidRequest');
  }
});
test('Given Custom and a blank dataset, when the form is read, then only Bearer settings reach the service', () => {
  const form = validForm(); form.set('axiom_dataset', '');
  assert.deepEqual(loggingForm(form, 'csrf'), { tenantId: 'tenant:a', expectedRevision: null, endpoint: 'https://collector.example/v1/logs', auth: 'bearer', token: '', enabled: false });
});
