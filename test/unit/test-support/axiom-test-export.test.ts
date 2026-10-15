import assert from 'node:assert/strict';
import { test } from 'node:test';
import { axiomExportHeaders } from '../../support/axiom-test-export.ts';

test('Given Axiom test settings, when the export headers are built, then they are exactly the Authorization header with the API key as a bearer token and the X-Axiom-Dataset header with the dataset', () => {
  const settings = { apiKey: 'test-key', endpoint: 'https://us-east-1.aws.edge.axiom.co/v1/logs', dataset: 'system-log-test' };

  assert.deepEqual(axiomExportHeaders(settings), { Authorization: 'Bearer test-key', 'X-Axiom-Dataset': 'system-log-test' });
});
