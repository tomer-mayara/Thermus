import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { openAxiomLogging, type AxiomLogging } from '../../../support/in-process/axiom-test-export.ts';
import { logRecordsOf, startLogReceiver } from '../../../support/doubles/logging/otel-log-receiver.ts';

const message = 'work-slice fetch started: https://news.example/story';
const callSite = String.raw`\[axiom-logging\.test\.(?:ts|js):\d+\]`;

function consoleSink(): { sink: Writable; lines: string[] } {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  return { sink, lines };
}

function openLogging(endpoint: string, sink: Writable): AxiomLogging {
  return openAxiomLogging({ apiKey: 'test-key', endpoint, dataset: 'system-log-test' }, 'thermus-axiom-logging-test', sink);
}

test('Given Axiom log settings that name a loopback receiver, when the Axiom test logging writes one INFO line and closes, then close() resolves, one OTLP JSON request carries the Axiom headers, the scope name, and the record, and the console gets nothing', { timeout: 20_000 }, async (t) => {
  const receiver = await startLogReceiver();
  t.after(() => receiver.close());
  const { sink, lines } = consoleSink();
  const logging = openLogging(receiver.endpoint, sink);

  logging.logger.info(message);
  const sentBeforeClose = receiver.requests.length;
  await assert.doesNotReject(logging.close());

  assert.equal(sentBeforeClose, 0);
  assert.equal(receiver.requests.length, 1);
  const [request] = receiver.requests;
  assert.equal(request.method, 'POST');
  assert.equal(request.path, '/v1/logs');
  assert.match(String(request.headers['content-type']), /^application\/json(?:;|$)/);
  assert.equal(request.headers.authorization, 'Bearer test-key');
  assert.equal(request.headers['x-axiom-dataset'], 'system-log-test');
  const body: { resourceLogs: { scopeLogs: { scope: { name: string } }[] }[] } = JSON.parse(request.body);
  assert.equal(body.resourceLogs[0].scopeLogs[0].scope.name, 'thermus-axiom-logging-test');
  const records = logRecordsOf(request);
  assert.equal(records.length, 1);
  assert.equal(records[0].severityNumber, 9);
  assert.equal(records[0].severityText, 'INFO');
  assert.match(records[0].body.stringValue, new RegExp(`^${callSite}: ${message.replaceAll('.', '\\.')}$`));
  assert.deepEqual(lines, []);
});
