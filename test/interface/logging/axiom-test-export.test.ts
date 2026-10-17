import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import { axiomTestSettings, trackTestExports } from '../../support/in-process/axiom-test-export.ts';

test('Given test settings, when the destination is selected, then only the Axiom test dataset and HTTPS endpoint are accepted', () => {
  const environment = { AXIOM_API_KEY: 'test-key', AXOIM_ENDPOINT_URL: 'https://us-east-1.aws.edge.axiom.co/ignored', AXIOM_SYSTEM_LOG_DATA_SET: 'system-log' };
  assert.equal(axiomTestSettings(environment).dataset, 'system-log-test');
  assert.equal(axiomTestSettings(environment).endpoint, 'https://us-east-1.aws.edge.axiom.co/v1/logs');
  for (const invalid of [
    { ...environment, AXIOM_API_KEY: '' },
    { ...environment, AXOIM_ENDPOINT_URL: '' },
    { ...environment, AXOIM_ENDPOINT_URL: 'http://us-east-1.aws.edge.axiom.co' },
    { ...environment, AXOIM_ENDPOINT_URL: 'https://example.com' },
    { ...environment, AXIOM_SYSTEM_LOG_TEST_DATA_SET: 'system-log' },
  ]) assert.throws(() => axiomTestSettings(invalid));
});

test('Given an exporter callback, when export finishes, then success is required and exporter errors stay private', () => {
  for (const code of [0, 1]) {
    const output: LogRecordExporter = {
      export(_records, complete) { complete({ code, error: new Error('private test-key') }); },
      async forceFlush() {},
      async shutdown() {},
    };
    const tracked = trackTestExports(output);
    tracked.exporter.export([], (result) => {
      if (code === 1) assert.equal(result.error?.message, 'Axiom rejected the test log export.');
    });
    if (code === 0) assert.doesNotThrow(() => tracked.assertSuccess());
    else assert.throws(() => tracked.assertSuccess(), { message: 'Axiom rejected the test log export.' });
  }
});

test('Given no completed callback, when export is checked, then the test fails', () => {
  const tracked = trackTestExports({ export() {}, async forceFlush() {}, async shutdown() {} });
  tracked.exporter.export([], () => {});
  assert.throws(() => tracked.assertSuccess(), { message: 'Axiom did not complete the test log export.' });
});
