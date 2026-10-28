import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { exportHeadersOf, resourceAttributesOf } from '../../../src/app/system-log-export.ts';

// SO-11a: the resource and the headers of each export request of the system log.

describe('The export request of the system log', () => {
  test('Given the export settings, when the resource is made, then it has service.name always and service.instance.id only with RENDER_INSTANCE_ID', () => {
    assert.deepEqual(resourceAttributesOf({ endpoint: 'https://api.axiom.co/v1/logs', token: 'token' }), { 'service.name': 'thermus-control-plane' });
    assert.deepEqual(resourceAttributesOf({ endpoint: 'https://api.axiom.co/v1/logs', token: 'token', instanceId: 'srv-d0example-hibernate' }), {
      'service.name': 'thermus-control-plane',
      'service.instance.id': 'srv-d0example-hibernate',
    });
  });

  test('Given the export settings, when the headers are made, then they have the bearer token, and the Axiom dataset only when the settings have one', () => {
    assert.deepEqual(exportHeadersOf({ endpoint: 'https://api.axiom.co/v1/logs', token: 'xaat-token' }), { Authorization: 'Bearer xaat-token' });
    assert.deepEqual(exportHeadersOf({ endpoint: 'https://api.axiom.co/v1/logs', token: 'xaat-token', dataset: 'system-log' }), {
      Authorization: 'Bearer xaat-token',
      'X-Axiom-Dataset': 'system-log',
    });
  });
});
