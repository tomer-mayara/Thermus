import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { LogLevel } from '../../../src/logging/base-logger.ts';
import { OtelLogger } from '../../../src/logging/otel-logger.ts';
import { createOtlpFixture, logRecordsOf } from '../../support/otel-log-receiver.ts';

describe('OtelLogger OTLP HTTP interface', () => {
  let fixture: Awaited<ReturnType<typeof createOtlpFixture>> | undefined;

  beforeEach(async () => {
    fixture = undefined;
    fixture = await createOtlpFixture({
      Authorization: 'Bearer test-token', 'X-Axiom-Dataset': 'system-log',
    });
  });

  afterEach(async () => {
    const current = fixture;
    fixture = undefined;
    await current?.close();
  });

  test('Given the official OTLP HTTP exporter with Axiom headers, when each level is logged and flushed, then a JSON POST carries all severity mappings and valid event times', { timeout: 10_000 }, async () => {
    assert.ok(fixture, 'The interface fixture must be ready.');
    const { provider, requests } = fixture;
    const logger = new OtelLogger(provider.getLogger('thermus'), LogLevel.DEBUG);

    const before = Date.now();
    logger.debug('debug event');
    logger.info('info event');
    logger.warning('warning event');
    logger.error('error event');
    logger.fatal('fatal event');
    await provider.forceFlush({ timeoutMillis: 3_000 });
    const after = Date.now();

    assert.equal(requests.length, 1);
    const request = requests[0];
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/v1/logs');
    assert.match(String(request.headers['content-type']), /^application\/json(?:;|$)/);
    assert.equal(request.headers.authorization, 'Bearer test-token');
    assert.equal(request.headers['x-axiom-dataset'], 'system-log');
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

  test('Given empty and Unicode multiline messages, when the official exporter serializes them, then the OTLP bodies preserve the source and text', { timeout: 10_000 }, async () => {
    assert.ok(fixture, 'The interface fixture must be ready.');
    const { provider, requests } = fixture;
    const logger = new OtelLogger(provider.getLogger('thermus'));
    const messages = ['', 'שלום 🌡️\nsecond line'];

    for (const message of messages) logger.info(message);
    await provider.forceFlush({ timeoutMillis: 3_000 });

    assert.equal(requests.length, 1);
    const records = logRecordsOf(requests[0]);
    assert.equal(records.length, messages.length);
    for (const [index, record] of records.entries()) {
      assert.match(record.body.stringValue, /^\[otel-logger\.test\.(?:ts|js):\d+\]: /);
      assert.equal(record.body.stringValue.slice(record.body.stringValue.indexOf(']: ') + 3), messages[index]);
    }
  });
});
