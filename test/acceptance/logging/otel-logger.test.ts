import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OtelLogger } from '../../../src/logging/otel-logger.ts';
import { createOtlpFixture, logRecordsOf } from '../../support/doubles/logging/otel-log-receiver.ts';

test('Given a default OtelLogger and Axiom system-log-test, when DEBUG and INFO are logged and flushed, then Axiom accepts the export and the HTTP body contains only INFO with its source', { timeout: 20_000 }, async (t) => {
  const { provider, requests, flush, scopeName } = await createOtlpFixture(t);
  const logger = new OtelLogger(provider.getLogger(scopeName));

  logger.debug('hidden debug event');
  logger.info('system log event');
  await flush();

  assert.equal(requests.length, 1);
  const records = logRecordsOf(requests[0]);
  assert.equal(records.length, 1);
  assert.equal(records[0].severityNumber, 9);
  assert.equal(records[0].severityText, 'INFO');
  assert.match(records[0].body.stringValue, /^\[otel-logger\.test\.(?:ts|js):\d+\]: system log event$/);
});
