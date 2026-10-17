import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LogLevel } from '../../../src/logging/base-logger.ts';
import { OtelLogger } from '../../../src/logging/otel-logger.ts';
import { createOtlpFixture, logRecordsOf } from '../../support/doubles/logging/otel-log-receiver.ts';

const testDataset = 'system-log-test';

test('Given the official OTLP HTTP exporter with Axiom headers, when each level is logged and flushed, then a JSON POST carries all severity mappings and valid event times', { timeout: 20_000 }, async (t) => {
  const { provider, requests, flush, scopeName } = await createOtlpFixture(t, {
    Authorization: 'Bearer test-token', 'X-Axiom-Dataset': testDataset,
  });
  const logger = new OtelLogger(provider.getLogger(scopeName), LogLevel.DEBUG);

  const before = Date.now();
  logger.debug('debug event');
  logger.info('info event');
  logger.warning('warning event');
  logger.error('error event');
  logger.fatal('fatal event');
  await flush();
  const after = Date.now();

  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(request.method, 'POST');
  assert.equal(request.path, '/v1/logs');
  assert.match(String(request.headers['content-type']), /^application\/json(?:;|$)/);
  assert.equal(request.headers.authorization, 'Bearer test-token');
  assert.equal(request.headers['x-axiom-dataset'], testDataset);
  const records = logRecordsOf(request);
  assert.deepEqual(records.map(({ severityNumber }) => severityNumber), [5, 9, 13, 17, 21]);
  assert.deepEqual(records.map(({ severityText }) => severityText), ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'FATAL']);
  for (const [index, record] of records.entries()) {
    const message = ['debug', 'info', 'warning', 'error', 'fatal'][index];
    assert.match(record.body.stringValue, new RegExp(`^\\[otel-logger\\.test\\.(?:ts|js):\\d+\\]: ${message} event$`));
    assert.match(record.timeUnixNano, /^\d+$/);
    const milliseconds = Number(BigInt(record.timeUnixNano) / 1_000_000n);
    assert.ok(milliseconds >= before - 1_000 && milliseconds <= after, 'The event time must be current.');
  }
});

test('Given empty and Unicode multiline messages, when the official exporter serializes them, then the OTLP bodies preserve the source and text', { timeout: 20_000 }, async (t) => {
  const { provider, requests, flush, scopeName } = await createOtlpFixture(t);
  const logger = new OtelLogger(provider.getLogger(scopeName));
  const messages = ['', 'Hello 🌡️\nsecond line'];

  for (const message of messages) logger.info(message);
  await flush();

  assert.equal(requests.length, 1);
  const records = logRecordsOf(requests[0]);
  assert.equal(records.length, messages.length);
  for (const [index, record] of records.entries()) {
    assert.match(record.body.stringValue, /^\[otel-logger\.test\.(?:ts|js):\d+\]: /);
    assert.equal(record.body.stringValue.slice(record.body.stringValue.indexOf(']: ') + 3), messages[index]);
  }
});
