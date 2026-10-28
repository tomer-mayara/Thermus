import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import { exportHeadersOf, reportingFailures, resourceAttributesOf } from '../../../src/app/system-log-export.ts';

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

describe('The failure report of each export', () => {
  // An exporter that ends each export with the given result and records the calls.
  function exporterOf(result: Parameters<Parameters<LogRecordExporter['export']>[1]>[0], events: string[]): LogRecordExporter {
    return {
      export: (records, done) => { events.push(`export ${records.length}`); done(result); },
      forceFlush: async () => { events.push('forceFlush'); },
      shutdown: async () => { events.push('shutdown'); },
    };
  }

  test('Given an export that fails, when the batch ends, then the processor gets the result first and the report then gets the error', () => {
    const events: string[] = [];
    const failure = new Error('refused');
    const exporter = reportingFailures(exporterOf({ code: 1, error: failure }, events), (reported) => { events.push(`report ${reported === failure}`); });

    exporter.export([], (result) => { events.push(`done ${result.code}`); });

    assert.deepEqual(events, ['export 0', 'done 1', 'report true']);
  });

  test('Given an export that succeeds, when the batch ends, then nothing is reported, and the flush and the stop go to the exporter', async () => {
    const events: string[] = [];
    const exporter = reportingFailures(exporterOf({ code: 0 }, events), () => { events.push('report'); });

    exporter.export([], (result) => { events.push(`done ${result.code}`); });
    await exporter.forceFlush();
    await exporter.shutdown();

    assert.deepEqual(events, ['export 0', 'done 0', 'forceFlush', 'shutdown']);
  });
});
