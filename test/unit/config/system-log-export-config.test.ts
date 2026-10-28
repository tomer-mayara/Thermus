import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeploymentConfigError } from '../../../src/runtime/config/deployment-config.ts';
import { loadSystemLogExportSettings } from '../../../src/runtime/config/system-log-export-config.ts';

// SO-11a: the three settings of the system log export of the control plane (plan section 4.1).

type Environment = Record<string, string | undefined>;

const exportSettings: Environment = {
  SYSTEM_LOG_OTLP_ENDPOINT: 'https://api.axiom.co/v1/logs',
  SYSTEM_LOG_OTLP_TOKEN: 'xaat-private-token-value',
  SYSTEM_LOG_AXIOM_DATASET: 'system-log',
};
const endpointRule = 'SYSTEM_LOG_OTLP_ENDPOINT must be the https URL of an OTLP/HTTP logs endpoint, such as https://api.axiom.co/v1/logs, without spaces, a username, a password, a query, or a fragment.';
const tokenRequired = 'SYSTEM_LOG_OTLP_TOKEN is required when SYSTEM_LOG_OTLP_ENDPOINT or SYSTEM_LOG_AXIOM_DATASET is set.';
const endpointRequired = 'SYSTEM_LOG_OTLP_ENDPOINT is required when SYSTEM_LOG_OTLP_TOKEN or SYSTEM_LOG_AXIOM_DATASET is set.';

// The message of a refused start, which must hold no value of the settings.
function refusal(environment: Environment): string {
  let message = '';
  assert.throws(() => loadSystemLogExportSettings(environment), (error) => {
    assert.ok(error instanceof DeploymentConfigError, `Expected a DeploymentConfigError, got ${String(error)}`);
    message = error.message;
    return true;
  });
  const values = Object.values(environment).filter((value): value is string => value !== undefined && value.length > 3);
  assert.deepEqual(values.filter((value) => message.includes(value)), [], 'The message must not contain a setting value.');
  return message;
}

test('Given none of the three settings, or each one empty, when the settings load, then there is no export', () => {
  assert.equal(loadSystemLogExportSettings({}), undefined);
  assert.equal(loadSystemLogExportSettings({ SYSTEM_LOG_OTLP_ENDPOINT: '', SYSTEM_LOG_OTLP_TOKEN: '', SYSTEM_LOG_AXIOM_DATASET: '' }), undefined);
  assert.equal(loadSystemLogExportSettings({ RENDER_INSTANCE_ID: 'srv-instance' }), undefined);
});

test('Given the three settings, when the settings load, then the export has the endpoint, the token, and the dataset, in a frozen record', () => {
  const settings = loadSystemLogExportSettings(exportSettings);

  assert.deepEqual(settings, { endpoint: 'https://api.axiom.co/v1/logs', token: 'xaat-private-token-value', dataset: 'system-log' });
  assert.ok(Object.isFrozen(settings));
});

test('Given the endpoint and the token without a dataset, when the settings load, then the export has no dataset, for a collector that is not Axiom', () => {
  assert.deepEqual(loadSystemLogExportSettings({ ...exportSettings, SYSTEM_LOG_AXIOM_DATASET: undefined }), { endpoint: 'https://api.axiom.co/v1/logs', token: 'xaat-private-token-value' });
  assert.deepEqual(loadSystemLogExportSettings({ ...exportSettings, SYSTEM_LOG_AXIOM_DATASET: '' }), { endpoint: 'https://api.axiom.co/v1/logs', token: 'xaat-private-token-value' });
});

test('Given the three settings and RENDER_INSTANCE_ID, when the settings load, then the export has the instance of Render', () => {
  assert.equal(loadSystemLogExportSettings({ ...exportSettings, RENDER_INSTANCE_ID: 'srv-d0example-hibernate' })?.instanceId, 'srv-d0example-hibernate');
  assert.equal(loadSystemLogExportSettings({ ...exportSettings, RENDER_INSTANCE_ID: '' })?.instanceId, undefined);
});

test('Given the endpoint without the token, when the settings load, then the start stops with the rule that names the token', () => {
  assert.equal(refusal({ ...exportSettings, SYSTEM_LOG_OTLP_TOKEN: undefined }), tokenRequired);
  assert.equal(refusal({ SYSTEM_LOG_OTLP_ENDPOINT: exportSettings.SYSTEM_LOG_OTLP_ENDPOINT, SYSTEM_LOG_OTLP_TOKEN: '' }), tokenRequired);
});

test('Given the token without the endpoint, or the dataset alone, when the settings load, then the start stops with the rule that names the endpoint', () => {
  assert.equal(refusal({ ...exportSettings, SYSTEM_LOG_OTLP_ENDPOINT: undefined }), endpointRequired);
  assert.equal(refusal({ SYSTEM_LOG_OTLP_TOKEN: exportSettings.SYSTEM_LOG_OTLP_TOKEN }), endpointRequired);
  assert.equal(refusal({ SYSTEM_LOG_AXIOM_DATASET: 'system-log' }), endpointRequired);
});

for (const endpoint of [
  'http://otlp.example.net/v1/logs',
  'https://operator:private-password@otlp.example.net/v1/logs',
  'https://private-user@otlp.example.net/v1/logs',
  'https://otlp.example.net/v1/logs?dataset=private-dataset',
  'https://otlp.example.net/v1/logs#private-fragment',
  'https://otlp.example.net/v1/logs ',
  'otlp.example.net/v1/logs',
  'not a url',
  'ftp://otlp.example.net/v1/logs',
]) {
  test(`Given SYSTEM_LOG_OTLP_ENDPOINT ${JSON.stringify(endpoint)}, when the settings load, then the start stops with the rule of the endpoint and without the value`, () => {
    assert.equal(refusal({ ...exportSettings, SYSTEM_LOG_OTLP_ENDPOINT: endpoint }), endpointRule);
  });
}

for (const token of ['xaat private token', 'xaat-private-token\n', 'xaat-private\u0000token']) {
  test(`Given SYSTEM_LOG_OTLP_TOKEN with a space or a control character ${JSON.stringify(token.replace(/[^\s\p{Cc}]/gu, ''))}, when the settings load, then the start stops with the rule of the token and without the value`, () => {
    assert.equal(refusal({ ...exportSettings, SYSTEM_LOG_OTLP_TOKEN: token }), 'SYSTEM_LOG_OTLP_TOKEN must not contain spaces or control characters.');
  });
}

for (const dataset of ['system_log', 'system.log', 'system log', 'système', 'x'.repeat(129)]) {
  test(`Given SYSTEM_LOG_AXIOM_DATASET ${JSON.stringify(dataset.length > 20 ? `${dataset.slice(0, 8)}… (${dataset.length} characters)` : dataset)}, when the settings load, then the start stops with the dataset name rule of the audit destination and without the value`, () => {
    assert.equal(refusal({ ...exportSettings, SYSTEM_LOG_AXIOM_DATASET: dataset }), 'SYSTEM_LOG_AXIOM_DATASET must have 1 to 128 letters, digits, or hyphens.');
  });
}

test('Given a dataset of 128 letters, digits, and hyphens, when the settings load, then the export keeps it', () => {
  const dataset = `Thermus-0-${'x'.repeat(118)}`;
  assert.equal(loadSystemLogExportSettings({ ...exportSettings, SYSTEM_LOG_AXIOM_DATASET: dataset })?.dataset, dataset);
});
