import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { openAxiomLogging, type AxiomLogging } from '../../support/in-process/axiom-test-export.ts';
import { logRecordsOf, startLogReceiver } from '../../support/doubles/logging/otel-log-receiver.ts';

const message = 'work-slice fetch started: https://news.example/story';
const callSite = String.raw`\[axiom-logging\.test\.(?:ts|js):\d+\]`;
const refusalBody = '{"message":"private-refusal-text"}';
const refusedExportLine = /^Axiom log export failed: \S.* with HTTP 401\.\n$/;
const oneFailedExport = 'Axiom refused or did not accept 1 log export. See the lines above.';
const defaultBatchSize = 512;

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

async function closedLoopbackEndpoint(): Promise<string> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  server.close();
  await once(server, 'close');
  return `http://127.0.0.1:${port}/v1/logs`;
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

test('Given a loopback receiver that refuses the export with 401 and a JSON body, when the Axiom test logging writes one INFO line and closes, then close() rejects with the count of failed exports, and the console gets only one failure line with the HTTP status and without the error message or the body', { timeout: 20_000 }, async (t) => {
  const receiver = await startLogReceiver(401, refusalBody);
  t.after(() => receiver.close());
  const { sink, lines } = consoleSink();
  const logging = openLogging(receiver.endpoint, sink);

  logging.logger.info(message);
  await assert.rejects(logging.close(), { message: oneFailedExport });

  assert.equal(receiver.requests.length, 1);
  assert.equal(lines.length, 1, lines.join(''));
  assert.match(lines[0], refusedExportLine);
  for (const privateText of ['private-refusal-text', 'Unauthorized']) assert.ok(!lines[0].includes(privateText), lines[0]);
});

test('Given a loopback receiver that refuses each export with 401, when the Axiom test logging writes one line more than a batch holds and closes, then close() rejects with the plural count, and the console gets only one failure line for each export', { timeout: 20_000 }, async (t) => {
  const receiver = await startLogReceiver(401, refusalBody);
  t.after(() => receiver.close());
  const { sink, lines } = consoleSink();
  const logging = openLogging(receiver.endpoint, sink);

  for (let count = 0; count <= defaultBatchSize; count += 1) logging.logger.info(message);
  await assert.rejects(logging.close(), { message: 'Axiom refused or did not accept 2 log exports. See the lines above.' });

  assert.equal(receiver.requests.length, 2);
  assert.equal(lines.length, 2, lines.join(''));
  for (const line of lines) assert.match(line, refusedExportLine);
});

// OTel 0.223 retries a refused connection with backoff until the exporter deadline of 10 seconds.
test('Given an endpoint on a closed loopback port, when the Axiom test logging writes one INFO line and closes, then close() rejects with the count of failed exports, and the console gets only one failure line with the system error name and without an HTTP status, the address, or the error message', { timeout: 30_000 }, async () => {
  const { sink, lines } = consoleSink();
  const logging = openLogging(await closedLoopbackEndpoint(), sink);

  logging.logger.info(message);
  await assert.rejects(logging.close(), { message: oneFailedExport });

  assert.equal(lines.length, 1, lines.join(''));
  assert.match(lines[0], /^Axiom log export failed: \S+ \(ECONNREFUSED\)\.\n$/);
  for (const privateText of [' with HTTP ', '127.0.0.1']) assert.ok(!lines[0].includes(privateText), lines[0]);
});
