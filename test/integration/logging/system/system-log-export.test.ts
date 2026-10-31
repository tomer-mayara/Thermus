import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { openSystemLogExport } from '../../../../src/app/system-log-export.ts';
import { SystemLogOutput } from '../../../../src/app/system-log-output.ts';
import { LogLevel, SystemLogger, type SystemLogRecord } from '../../../../src/logs/system/system-logger.ts';
import type { SystemLogExportSettings } from '../../../../src/runtime/config/system-log-export-config.ts';
import { logRecordsOf, resourceAttributesOf, startLogReceiver, type LogReceiver, type LogReceiverOptions } from '../../../support/doubles/logging/otel-log-receiver.ts';

// SO-11a: the SDK composition of app with SystemLogger, OtelSystemLogSink, and the OTLP/HTTP JSON exporter, against a
// local double of the logs endpoint. The double serves plain http: the settings reader, which refuses http, is not in
// this composition.

const callSite = String.raw`\[system-log-export\.test\.(?:ts|js):\d+\]: `;

interface Composition {
  readonly receiver: LogReceiver;
  readonly logger: SystemLogger;
  readonly output: SystemLogOutput;
  readonly standardError: SystemLogRecord[];
  readonly failureLines: string[];
}

async function compose(t: TestContext, options: LogReceiverOptions = {}, settings: Partial<SystemLogExportSettings> = {}): Promise<Composition> {
  const receiver = await startLogReceiver(options);
  t.after(() => receiver.close());
  const standardError: SystemLogRecord[] = [];
  const failureLines: string[] = [];
  const output = new SystemLogOutput({ writeSystemLog: (record) => { standardError.push(record); } }, { error: (message) => { failureLines.push(String(message)); } });
  const exportSettings = { endpoint: receiver.endpoint, token: 'integration-token', dataset: 'integration-dataset', ...settings };
  output.startExport(await openSystemLogExport(exportSettings, (failure) => output.reportExportFailure(failure)));
  t.after(() => output.close());
  return { receiver, logger: new SystemLogger(output), output, standardError, failureLines };
}

describe('System log export with the OpenTelemetry SDK', () => {
  test('Given the composition with a local OTLP/HTTP double, when the logger writes an INFO and an ERROR record and the output closes, then one request carries both records with the bearer token, the dataset, and the resource, and standard error has both lines', { timeout: 20_000 }, async (t) => {
    const { receiver, logger, output, standardError, failureLines } = await compose(t, {}, { instanceId: 'srv-integration-instance' });

    logger.info('The integration export started.');
    logger.error(new Error('An integration request failed.'));
    const sentBeforeClose = receiver.requests.length;
    await output.close();

    assert.equal(sentBeforeClose, 0, 'The batch waits for the scheduled export or the close.');
    assert.equal(receiver.requests.length, 1);
    const [request] = receiver.requests;
    assert.equal(request.method, 'POST');
    assert.match(String(request.headers['content-type']), /^application\/json(?:;|$)/);
    assert.equal(request.headers.authorization, 'Bearer integration-token');
    assert.equal(request.headers['x-axiom-dataset'], 'integration-dataset');
    assert.deepEqual(resourceAttributesOf(request), [{ 'service.name': 'thermus-control-plane', 'service.instance.id': 'srv-integration-instance' }]);
    const records = logRecordsOf(request);
    assert.deepEqual(records.map(({ severityNumber, severityText }) => [severityNumber, severityText]), [[9, 'INFO'], [17, 'ERROR']]);
    assert.match(records[0].body.stringValue, new RegExp(`^${callSite}The integration export started\\.$`));
    assert.match(records[1].body.stringValue, new RegExp(`^${callSite}An integration request failed\\.$`));
    assert.deepEqual(standardError.map(({ level, message }) => [level, message]), records.map(({ severityText, body }) => [LogLevel[severityText as keyof typeof LogLevel], body.stringValue]));
    assert.deepEqual(failureLines, []);
  });

  test('Given settings without a dataset and without an instance, when a record is exported, then the request has no X-Axiom-Dataset header and the resource has only service.name', { timeout: 20_000 }, async (t) => {
    const { receiver, logger, output } = await compose(t, {}, { dataset: undefined });

    logger.info('A record for a collector that is not Axiom.');
    await output.close();

    assert.equal(receiver.requests.length, 1);
    assert.equal(receiver.requests[0].headers['x-axiom-dataset'], undefined);
    assert.deepEqual(resourceAttributesOf(receiver.requests[0]), [{ 'service.name': 'thermus-control-plane' }]);
  });

  test('Given a double that answers 500, when records are exported, then the exporter sends the batch once and drops it, one failure line names HTTP 500, and standard error keeps the records', { timeout: 20_000 }, async (t) => {
    const { receiver, logger, output, standardError, failureLines } = await compose(t, { status: 500 });

    logger.info('A record that the endpoint refuses.');
    logger.error('Another record that the endpoint refuses.');
    await output.close();

    assert.equal(receiver.requests.length, 1, 'A 500 answer gets no retry.');
    assert.equal(logRecordsOf(receiver.requests[0]).length, 2);
    assert.equal(standardError.length, 2);
    assert.deepEqual(failureLines, ['System log export failed: HTTP 500. The records of that export are dropped.']);
  });

  test('Given a double that answers 503, when a record is exported, then the exporter tries again within its bound of 4 s and then drops the batch with one failure line', { timeout: 20_000 }, async (t) => {
    const { receiver, logger, output, failureLines } = await compose(t, { status: 503 });

    logger.info('A record that the endpoint cannot take now.');
    const started = performance.now();
    await output.close();
    const elapsed = performance.now() - started;

    assert.ok(receiver.requests.length > 1, 'A 503 answer gets bounded retries.');
    assert.ok(elapsed < 5_000, `The close took ${Math.round(elapsed)} ms.`);
    assert.equal(failureLines.length, 1);
    assert.match(failureLines[0], /^System log export failed: HTTP 429, 502, 503, or 504 after the retries\. The records of that export are dropped\.$/);
  });

  test('Given an export in flight, when 2,048 more records wait and 5 more are written, then the queue drops the 5 newest records, and each request holds at most 512 records', { timeout: 20_000 }, async (t) => {
    const held = Promise.withResolvers<void>();
    const { receiver, logger, output, standardError } = await compose(t, { answerAfter: held.promise });

    for (let index = 0; index < 512 + 2_048 + 5; index += 1) logger.info(`record ${index}`);
    held.resolve();
    await output.close();

    const exported = receiver.requests.flatMap(logRecordsOf).map(({ body }) => body.stringValue.replace(new RegExp(`^${callSite}`), ''));
    assert.equal(standardError.length, 512 + 2_048 + 5);
    assert.equal(exported.length, 512 + 2_048);
    assert.deepEqual(exported.slice(-1), ['record 2559']);
    assert.ok(!exported.includes('record 2560'), 'The newest records are dropped.');
    assert.ok(receiver.requests.every((request) => logRecordsOf(request).length <= 512));
  });
});
