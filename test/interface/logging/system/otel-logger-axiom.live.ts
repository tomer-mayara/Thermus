import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor, LoggerProvider, type LogRecordExporter } from '@opentelemetry/sdk-logs';
import { axiomExportHeaders, axiomTestSettings } from '../../../support/in-process/axiom-test-export.ts';
import { openSystemLogExport } from '../../../../src/app/system-log-export.ts';
import { SystemLogOutput } from '../../../../src/app/system-log-output.ts';
import { SystemLogger, type SystemLogRecord } from '../../../../src/logs/system/system-logger.ts';
import { OtelSystemLogSink } from '../../../../src/logs/system/otel-system-log-sink.ts';

describe('OtelSystemLogSink live Axiom OTLP interface', () => {
  let fixture: { provider: LoggerProvider; resultCodes: number[] } | undefined;

  beforeEach(async () => {
    fixture = undefined;
    const settings = axiomTestSettings();
    const output = new OTLPLogExporter({
      url: settings.endpoint,
      headers: axiomExportHeaders(settings),
      timeoutMillis: 5_000,
    });
    const resultCodes: number[] = [];
    const exporter: LogRecordExporter = {
      export(records, complete) {
        output.export(records, (result) => {
          resultCodes.push(result.code);
          complete(result);
        });
      },
      forceFlush: () => output.forceFlush(),
      shutdown: () => output.shutdown(),
    };
    try {
      const processor = new BatchLogRecordProcessor({ exporter, scheduledDelayMillis: 60_000, exportTimeoutMillis: 6_000 });
      const provider = new LoggerProvider({ processors: [processor] });
      fixture = { provider, resultCodes };
    } catch (error) {
      await output.shutdown();
      throw error;
    }
  });

  afterEach(async () => {
    const current = fixture;
    fixture = undefined;
    await current?.provider.shutdown();
  });

  test('Given Axiom ingestion settings, when a unique INFO event is exported and flushed, then the OTLP exporter reports success', { timeout: 20_000 }, async (t) => {
    assert.ok(fixture, 'The live interface fixture must be ready.');
    const { provider, resultCodes } = fixture;
    const logger = new SystemLogger(new OtelSystemLogSink(provider.getLogger('thermus-interface-test')));
    const message = `thermus-otel-interface-${randomUUID()}`;

    logger.info(message);
    await provider.forceFlush({ timeoutMillis: 7_000 });

    assert.deepEqual(resultCodes, [0], 'The official exporter must report SUCCESS for the Axiom export.');
    t.diagnostic(`OTLP export succeeded for test event: ${message}`);
  });
});

// SO-11a: the production composition of the system log export of the control plane, with the Axiom test settings and
// the test dataset only. The production dataset system-log never gets a test record: axiomTestSettings() refuses each
// dataset other than system-log-test.
describe('System log export of the control plane, live Axiom', () => {
  test('Given the Axiom test settings and the dataset system-log-test, when the production composition writes one marked INFO record and stops, then the stop ends within its bound with no export failure line', { timeout: 20_000 }, async (t) => {
    const settings = axiomTestSettings();
    const standardError: SystemLogRecord[] = [];
    const failureLines: string[] = [];
    const output = new SystemLogOutput({ writeSystemLog: (record) => { standardError.push(record); } }, { error: (message) => { failureLines.push(String(message)); } });
    output.startExport(await openSystemLogExport({ endpoint: settings.endpoint, token: settings.apiKey, dataset: settings.dataset }, (failure) => output.reportExportFailure(failure)));
    const marker = `thermus-system-log-export-live-${randomUUID()}`;

    new SystemLogger(output).info(marker);
    await output.close();

    assert.equal(standardError.length, 1);
    assert.deepEqual(failureLines, [], 'The export to Axiom must end within the stop bound without a failure.');
    t.diagnostic(`The production composition exported the marked record ${marker} to ${settings.dataset}.`);
  });
});
