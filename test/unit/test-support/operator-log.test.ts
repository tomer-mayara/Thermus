import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { completionLinesIn, completionRecordsIn, listeningUrlIn, stepRecordsIn, tenantIn } from '../../support/drivers/operator-log.ts';

// The messages have the formats of src: the listening line of src/index.ts, the tenant line of src/app/application.ts,
// and the completion record of src/interfaces/mcp/tool-completion-record.ts.
const tenant = 'local:7303c1d8-a899-4392-8a3e-62b354fc839c';
const tenantMessage = `The self-hosted installation uses tenant ${tenant}.`;
const listeningMessage = 'Listening on http://127.0.0.1:52947';
const stoppingMessage = 'Stopping after SIGTERM';
const success = {
  event: 'mcp.tool.completed', authority: 'better-auth:7303c1d8-a899-4392-8a3e-62b354fc839c', subject: 'alice-id', tenantId: tenant,
  operationId: 'd35803fb-2c25-4273-8967-99eed265721b',
  tool: 'getURLAsMarkdown', url: 'http://127.0.0.1:8090/story', urlStatus: 'valid', reason: 'Summarize the story', reasonStatus: 'valid',
  status: 'success', durationMs: 12.5,
};
const failure = { ...success, operationId: 'e35803fb-2c25-4273-8967-99eed265721b', url: 'http://127.0.0.1:8090/missing', status: 'fetch_failed', durationMs: 3.25 };
const otherEvent = { event: 'pipeline.step.completed', operationId: success.operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' };

// A child process and a container give the text of src/logging/console-logger.ts. The time, the level in colour,
// and the call site come before each message, and a line break comes after it.
function consoleLine(site: string, message: string): string {
  return `[2026-10-15 07:56:03] \u001b[32mINFO\u001b[0m [${site}]: ${message}\n`;
}

describe('Operator log reader of the server sites', () => {
  test('Given step and completion events from two operations, when step records are selected, then only that event and exact operation ID match', () => {
    const secondStep = { ...otherEvent, operationId: failure.operationId, outcome: 'blocked', code: 'blocked' };
    const output = [success, otherEvent, secondStep, failure].map((record) => consoleLine('fetch-tool.js:31', JSON.stringify(record))).join('');

    assert.deepEqual(stepRecordsIn(output), [otherEvent, secondStep]);
    assert.deepEqual(stepRecordsIn(output, success.operationId), [otherEvent]);
    assert.deepEqual(stepRecordsIn(output, failure.operationId), [secondStep]);
    assert.deepEqual(stepRecordsIn(output, success.operationId.toUpperCase()), []);
    assert.deepEqual(stepRecordsIn(output, 'unknown-operation'), []);
    assert.deepEqual(stepRecordsIn(JSON.stringify(success)), []);
    assert.deepEqual(stepRecordsIn(''), []);
  });

  test('Given mixed events from two operations, when one exact ID is selected, then only its actual completion is read', () => {
    const output = [success, otherEvent, failure].map((record) => consoleLine('fetch-tool-server.js:77', JSON.stringify(record))).join('');

    assert.deepEqual(completionLinesIn(output, success.operationId), [JSON.stringify(success)]);
    assert.deepEqual(completionRecordsIn(output, failure.operationId), [failure]);
    assert.deepEqual(completionRecordsIn(output, success.operationId.toUpperCase()), []);
    assert.deepEqual(completionRecordsIn(output, 'unknown-operation'), []);
  });

  test('Given the output of a server, when the listening URL is read, then it is undefined before the listening line arrives, and it is the URL of that line when other lines are around it', () => {
    const beforeListening = consoleLine('application.js:95', tenantMessage);
    const output = beforeListening + consoleLine('index.js:109', listeningMessage) + consoleLine('index.js:111', stoppingMessage);

    assert.equal(listeningUrlIn(''), undefined);
    assert.equal(listeningUrlIn(beforeListening), undefined);
    assert.ok(listeningUrlIn(output) instanceof URL);
    assert.equal(listeningUrlIn(output)?.href, 'http://127.0.0.1:52947/');
  });

  test('Given the output of a server, when the tenant is read, then it is the local tenant of the tenant line, and it is undefined without that line or before the full stop of that line arrives', () => {
    const output = consoleLine('application.js:95', tenantMessage) + consoleLine('index.js:109', listeningMessage);
    const lineWithoutFullStop = consoleLine('application.js:95', tenantMessage).replace(/\.\n$/, '');

    assert.equal(tenantIn(output), tenant);
    assert.equal(tenantIn(consoleLine('index.js:109', listeningMessage)), undefined);
    assert.equal(tenantIn(lineWithoutFullStop), undefined);
  });

  test('Given an output with two completion records between other lines and a JSON line of another event, when the records are read, then they are the two records in their order, and an output without a record gives none', () => {
    const output = consoleLine('application.js:95', tenantMessage)
      + consoleLine('index.js:109', listeningMessage)
      + consoleLine('fetch-tool-server.js:77', JSON.stringify(success))
      + consoleLine('fetch-tool-server.js:30', JSON.stringify(otherEvent))
      + consoleLine('fetch-tool-server.js:77', JSON.stringify(failure))
      + consoleLine('index.js:111', stoppingMessage);

    assert.deepEqual(completionLinesIn(output), [JSON.stringify(success), JSON.stringify(failure)]);
    assert.deepEqual(completionRecordsIn(output), [success, failure]);
    assert.deepEqual(completionLinesIn(consoleLine('index.js:109', listeningMessage)), []);
    assert.deepEqual(completionRecordsIn(''), []);
  });

  test('Given the messages of the in-process logger as lines, when the lines are joined with line breaks and read, then they give the same URL, tenant, and records as the console text of the same messages', () => {
    const messages = [tenantMessage, listeningMessage, JSON.stringify(success), JSON.stringify(failure), stoppingMessage];
    const read = (output: string) => ({
      url: listeningUrlIn(output)?.href, tenant: tenantIn(output), lines: completionLinesIn(output), records: completionRecordsIn(output),
    });

    const fromLines = read(messages.join('\n'));
    const fromText = read(messages.map((message) => consoleLine('index.js:109', message)).join(''));

    assert.deepEqual(fromLines, {
      url: 'http://127.0.0.1:52947/', tenant, lines: [JSON.stringify(success), JSON.stringify(failure)], records: [success, failure],
    });
    assert.deepEqual(fromText, fromLines);
    assert.equal(listeningUrlIn(listeningMessage)?.href, 'http://127.0.0.1:52947/');
  });
});
