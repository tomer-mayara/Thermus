import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor, LoggerProvider, type LogRecordExporter } from '@opentelemetry/sdk-logs';
import { axiomExportHeaders, axiomTestSettings } from '../../support/in-process/axiom-test-export.ts';
import { OtelSystemLogger } from '../../../src/logs/system/otel-system-logger.ts';

describe('OtelSystemLogger live Axiom OTLP interface', () => {
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
    const logger = new OtelSystemLogger(provider.getLogger('thermus-interface-test'));
    const message = `thermus-otel-interface-${randomUUID()}`;

    logger.info(message);
    await provider.forceFlush({ timeoutMillis: 7_000 });

    assert.deepEqual(resultCodes, [0], 'The official exporter must report SUCCESS for the Axiom export.');
    t.diagnostic(`OTLP export succeeded for test event: ${message}`);
  });
});
