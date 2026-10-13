import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OtelLogger } from '../../../src/logging/otel-logger.ts';
import { createOtlpFixture, logRecordsOf } from '../../support/otel-log-receiver.ts';

test('Given a default OtelLogger and an OTLP destination, when DEBUG and INFO are logged and flushed, then the destination receives only INFO with its source', { timeout: 10_000 }, async (t) => {
  const fixture = await createOtlpFixture();
  t.after(fixture.close);
  const { provider, requests } = fixture;
  const logger = new OtelLogger(provider.getLogger('thermus'));

  logger.debug('hidden debug event');
  logger.info('system log event');
  await provider.forceFlush({ timeoutMillis: 3_000 });

  assert.equal(requests.length, 1);
  const records = logRecordsOf(requests[0]);
  assert.equal(records.length, 1);
  assert.equal(records[0].severityNumber, 9);
  assert.equal(records[0].severityText, 'INFO');
  assert.match(records[0].body.stringValue, /^\[otel-logger\.test\.(?:ts|js):\d+\]: system log event$/);
});
