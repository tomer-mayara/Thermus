import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { logRecordsOf, refusedLogEndpoint, resourceAttributesOf, startLogReceiver, type LogReceiver, type LogReceiverOptions } from '../../../support/doubles/logging/otel-log-receiver.ts';
import { consoleRecordsIn, type ConsoleRecord } from '../../../support/drivers/operator-log.ts';
import { hostedFetchSettings, hostedStartupLine, hostedStorageUnavailableLine, workOSSettings } from '../../../support/fixtures/hosted-placeholder.ts';
import { gatewayKeyPairOf, tenantSettingsOf } from '../../../support/fixtures/hosted-tenant.ts';
import { selfSignedCertificate } from '../../../support/hosted-live/local-https-site.ts';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';
import { ServerProcess, type ServerSettings } from '../../../support/processes/server-process.ts';

// SO-11a: the built server of the hosted control plane exports its system log to an OTLP/HTTP logs endpoint, in
// addition to standard error. The server runs with outbound access denied, except to the loopback double of the
// endpoint, which serves https with a test certificate that the server trusts through NODE_EXTRA_CA_CERTS.

const listen = { LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0' };
const hostedSettings: ServerSettings = { ...hostedFetchSettings, ...workOSSettings, ...listen, DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example' };
const token = 'system-log-token-of-the-acceptance-test';
const dataset = 'thermus-acceptance-test';
const failureLine = 'System log export failed: ';

// The three settings that name the endpoint, and the two settings that let the server reach it in the test.
function exportSettings(endpoint: string, port: number): ServerSettings {
  return { SYSTEM_LOG_OTLP_ENDPOINT: endpoint, SYSTEM_LOG_OTLP_TOKEN: token, SYSTEM_LOG_AXIOM_DATASET: dataset, THERMUS_TEST_LOOPBACK_PORT: String(port) };
}

async function httpsEndpoint(t: TestContext, options: LogReceiverOptions = {}): Promise<{ receiver: LogReceiver; settings: ServerSettings }> {
  const directory = dataDirectory(t);
  const receiver = await startLogReceiver({ ...options, tls: await selfSignedCertificate(directory) });
  t.after(() => receiver.close());
  return { receiver, settings: { ...exportSettings(receiver.endpoint, receiver.port), NODE_EXTRA_CA_CERTS: join(directory, 'cert.pem') } };
}

const exportedRecords = (receiver: LogReceiver): ConsoleRecord[] => receiver.requests.flatMap(logRecordsOf).map(({ severityText, body }) => ({ level: severityText, message: body.stringValue }));
const failureLines = (server: ServerProcess): ConsoleRecord[] => consoleRecordsIn(server.output).filter(({ message }) => message.includes(failureLine));

// The first scheduled export starts at most 2 s after the first line, and its retries end within 4 s.
async function untilFailureLine(t: TestContext, server: ServerProcess): Promise<void> {
  const deadline = performance.now() + 20_000;
  while (failureLines(server).length === 0) {
    assert.ok(performance.now() < deadline, `No export failure line in 20 s:\n${server.output}`);
    await delay(50, undefined, { signal: t.signal });
  }
}

async function assertStopsBeforeListening(server: ServerProcess, message: RegExp): Promise<void> {
  assert.equal(await server.listeningOrExit(), undefined, server.output);
  assert.notEqual((await server.exited()).code, 0);
  assert.match(server.output, message);
}

describe('System log export of the control plane (SO-11a)', () => {
  test('Given the three export settings with the endpoint of a local OTLP/HTTP double, when the control plane writes INFO and ERROR records, then the double gets them with the bearer token, the dataset, their severity, and the message with the caller file and line, and standard error has the same lines', { timeout: 60_000 }, async (t) => {
    const { receiver, settings } = await httpsEndpoint(t);

    const server = await ServerProcess.start(t, { ...hostedSettings, ...settings, RENDER_INSTANCE_ID: 'srv-acceptance-instance' });
    const exit = await server.stop();

    assert.deepEqual(exit, { code: 0, signal: null }, server.output);
    assert.ok(receiver.requests.length > 0, server.output);
    for (const request of receiver.requests) {
      assert.equal(request.method, 'POST');
      assert.equal(request.path, '/v1/logs');
      assert.equal(request.headers.authorization, `Bearer ${token}`);
      assert.equal(request.headers['x-axiom-dataset'], dataset);
      assert.deepEqual(resourceAttributesOf(request), [{ 'service.name': 'thermus-control-plane', 'service.instance.id': 'srv-acceptance-instance' }]);
    }
    const records = receiver.requests.flatMap(logRecordsOf);
    assert.ok(records.some(({ severityText, severityNumber, body }) => severityText === 'INFO' && severityNumber === 9
      && /^\[hosted-workos-application\.(?:js|ts):\d+\]: /.test(body.stringValue) && body.stringValue.endsWith(hostedStartupLine)), JSON.stringify(records));
    assert.ok(records.some(({ severityText, severityNumber, body }) => severityText === 'ERROR' && severityNumber === 17
      && /^\[logging-storage\.(?:js|ts):\d+\]: /.test(body.stringValue) && body.stringValue.endsWith(hostedStorageUnavailableLine)), JSON.stringify(records));
    assert.ok(records.every(({ body }) => !body.stringValue.includes('\u001b')), 'An exported body has no color code.');
    assert.deepEqual(exportedRecords(receiver), consoleRecordsIn(server.output), 'Each line of standard error is exported once, in the same order.');
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given the three export settings and a double that answers 500, when the control plane logs, serves a request, and stops, then standard error has each line, the request succeeds, and standard error has one export failure line that the export does not carry', { timeout: 60_000 }, async (t) => {
    const { receiver, settings } = await httpsEndpoint(t, { status: 500 });

    const server = await ServerProcess.start(t, { ...hostedSettings, ...settings });
    await untilFailureLine(t, server);
    const health = await server.request('/healthz');
    const exit = await server.stop();

    assert.equal(health.status, 200);
    assert.deepEqual(exit, { code: 0, signal: null }, server.output);
    assert.ok(receiver.requests.length >= 2, 'The scheduled export and the export at the stop both failed.');
    assert.deepEqual(failureLines(server).map(({ level, message }) => [level, message.replace(/^\[[^\]]*\]: /, '')]), [
      ['ERROR', 'System log export failed: HTTP 500. The records of that export are dropped.'],
    ]);
    const lines = consoleRecordsIn(server.output).filter(({ message }) => !message.includes(failureLine));
    assert.deepEqual(exportedRecords(receiver), lines, 'The double got each line of standard error except the failure line.');
    assert.ok(lines.some(({ message }) => message.endsWith('Stopping after SIGTERM')), server.output);
  });

  test('Given the three export settings and an endpoint that refuses the connection, when the control plane logs, serves a request, and stops, then standard error has each line, the request succeeds, and standard error has one export failure line', { timeout: 60_000 }, async (t) => {
    const refused = await refusedLogEndpoint();

    const server = await ServerProcess.start(t, { ...hostedSettings, ...exportSettings(refused.endpoint, refused.port) });
    await untilFailureLine(t, server);
    const health = await server.request('/healthz');
    const exit = await server.stop();

    assert.equal(health.status, 200);
    assert.deepEqual(exit, { code: 0, signal: null }, server.output);
    assert.deepEqual(failureLines(server).map(({ message }) => message.replace(/^\[[^\]]*\]: /, '')), ['System log export failed: ECONNREFUSED. The records of that export are dropped.']);
    for (const line of [hostedStartupLine, hostedStorageUnavailableLine, 'Stopping after SIGTERM']) {
      assert.ok(consoleRecordsIn(server.output).some(({ message }) => message.endsWith(line)), server.output);
    }
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given none of the three export settings, when the control plane starts and stops, then it opens no connection and standard error has the lines of today', { timeout: 60_000 }, async (t) => {
    const server = await ServerProcess.start(t, hostedSettings);
    const exit = await server.stop();

    assert.deepEqual(exit, { code: 0, signal: null }, server.output);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
    assert.deepEqual(consoleRecordsIn(server.output).map(({ level, message }) => [level, message.replace(/^\[[^\]]*\]: /, '').replace(/:\d+$/, ':<port>')]), [
      ['INFO', hostedStartupLine],
      ['ERROR', hostedStorageUnavailableLine],
      ['INFO', 'Listening on http://127.0.0.1:<port>'],
      ['INFO', 'Stopping after SIGTERM'],
    ]);
  });

  test('Given the endpoint without the token, the token without the endpoint, an http endpoint, or a dataset outside the name rule, when the control plane starts, then it stops before it listens with a FATAL line that names the setting and the rule but not the value', { timeout: 60_000 }, async (t) => {
    const refusals: ReadonlyArray<readonly [ServerSettings, RegExp]> = [
      [{ SYSTEM_LOG_OTLP_ENDPOINT: 'https://logs.example/v1/logs' }, /FATAL\S* (?:\[[^\]]*\]: )?SYSTEM_LOG_OTLP_TOKEN is required when SYSTEM_LOG_OTLP_ENDPOINT or SYSTEM_LOG_AXIOM_DATASET is set\.$/m],
      [{ SYSTEM_LOG_OTLP_TOKEN: 'private-token-without-endpoint' }, /FATAL\S* (?:\[[^\]]*\]: )?SYSTEM_LOG_OTLP_ENDPOINT is required when SYSTEM_LOG_OTLP_TOKEN or SYSTEM_LOG_AXIOM_DATASET is set\.$/m],
      [{ SYSTEM_LOG_OTLP_ENDPOINT: 'http://logs.example/v1/logs', SYSTEM_LOG_OTLP_TOKEN: 'private-token-with-http' }, /FATAL\S* (?:\[[^\]]*\]: )?SYSTEM_LOG_OTLP_ENDPOINT must be the https URL of an OTLP\/HTTP logs endpoint/m],
      [{ SYSTEM_LOG_OTLP_ENDPOINT: 'https://logs.example/v1/logs', SYSTEM_LOG_OTLP_TOKEN: 'private-token-with-dataset', SYSTEM_LOG_AXIOM_DATASET: 'private_dataset' }, /FATAL\S* (?:\[[^\]]*\]: )?SYSTEM_LOG_AXIOM_DATASET must have 1 to 128 letters, digits, or hyphens\.$/m],
    ];

    for (const [overrides, message] of refusals) {
      const server = ServerProcess.launch(t, { ...hostedSettings, ...overrides });

      await assertStopsBeforeListening(server, message);
      for (const value of Object.values(overrides)) assert.ok(!server.output.includes(value), server.output);
      assert.equal(server.attemptedOutboundAccess, false, server.output);
    }
  });

  test('Given the three export settings and a refused WorkOS setting, when the control plane stops at its start, then the double gets the FATAL line before the process ends', { timeout: 60_000 }, async (t) => {
    const { receiver, settings } = await httpsEndpoint(t);
    const server = ServerProcess.launch(t, { ...hostedSettings, ...settings, WORKOS_COOKIE_PASSWORD: 'too-short' });

    await assertStopsBeforeListening(server, /FATAL.*The hosted edition cannot start/);
    const fatal = exportedRecords(receiver).filter(({ level }) => level === 'FATAL');
    assert.equal(fatal.length, 1, server.output);
    assert.match(fatal[0]?.message ?? '', /The hosted edition cannot start/);
  });

  test('Given THERMUS_ROLE=tenant with SYSTEM_LOG_OTLP_TOKEN, when the tenant starts, then it stops before it listens with the refusal that names the setting but not the value', { timeout: 60_000 }, async (t) => {
    const value = 'private-token-in-a-tenant';
    const server = ServerProcess.launch(t, {
      ...hostedFetchSettings,
      ...tenantSettingsOf(gatewayKeyPairOf().publicKeyPem, 'http://thermus-control-plane:8080'),
      ...listen,
      SYSTEM_LOG_OTLP_TOKEN: value,
    });

    await assertStopsBeforeListening(server, /FATAL.*The tenant role refuses SYSTEM_LOG_OTLP_TOKEN: a tenant holds no secret of the control plane\./);
    assert.ok(!server.output.includes(value), server.output);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given the three export settings and a stop signal, when the process stops, then the export flushes the last records within 5 s', { timeout: 60_000 }, async (t) => {
    const { receiver, settings } = await httpsEndpoint(t);
    const server = await ServerProcess.start(t, { ...hostedSettings, ...settings });

    const signalled = performance.now();
    const exit = await server.stop();

    assert.deepEqual(exit, { code: 0, signal: null }, server.output);
    const stop = receiver.requests.find((request) => logRecordsOf(request).some(({ body }) => body.stringValue.endsWith('Stopping after SIGTERM')));
    assert.ok(stop, 'The double got the stop line.');
    assert.ok(stop.receivedAt - signalled < 5_000, `The stop line came ${Math.round(stop.receivedAt - signalled)} ms after the signal.`);
  });

  test('Given the three export settings and an endpoint that does not answer, when the process gets a stop signal, then it stops with status 0 before the hosted shutdown deadline ends it', { timeout: 60_000 }, async (t) => {
    const { receiver, settings } = await httpsEndpoint(t, { answers: false });
    const server = await ServerProcess.start(t, { ...hostedSettings, ...settings });

    const signalled = performance.now();
    const exit = await server.stop();
    const elapsed = performance.now() - signalled;

    assert.deepEqual(exit, { code: 0, signal: null }, server.output);
    assert.doesNotMatch(server.output, /Hosted shutdown exceeded/);
    assert.ok(receiver.requests.length > 0, 'The flush at the stop sent the last records.');
    assert.ok(elapsed < 15_000, `The stop took ${Math.round(elapsed)} ms.`);
  });
});
