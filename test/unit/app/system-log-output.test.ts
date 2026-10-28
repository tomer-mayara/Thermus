import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SystemLogOutput, type SystemLogExport } from '../../../src/app/system-log-output.ts';
import { LogLevel, type SystemLogRecord, type SystemLogSink } from '../../../src/logs/system/system-logger.ts';

// SO-11a: the sink of the process writes each record to standard error, and to the export once it starts. A failed
// export gives one line on standard error at most once a minute, never through the export.

const info: SystemLogRecord = { level: LogLevel.INFO, time: '2026-10-28 03:21:00', message: '[caller.ts:1]: The server started.' };
const error: SystemLogRecord = { level: LogLevel.ERROR, time: '2026-10-28 03:21:01', message: '[caller.ts:2]: A request failed.' };

class OutputSpy {
  readonly writes: [string, SystemLogRecord][] = [];
  readonly failureLines: string[] = [];
  readonly closes: string[] = [];
  now = 0;

  sink(name: string): SystemLogSink {
    return { writeSystemLog: (record) => { this.writes.push([name, record]); } };
  }

  exported(name = 'export'): SystemLogExport {
    return { sink: this.sink(name), close: async () => { this.closes.push(name); } };
  }

  output(): SystemLogOutput {
    return new SystemLogOutput(this.sink('console'), { error: (message) => { this.failureLines.push(String(message)); } }, () => this.now);
  }
}

function refusing(failure: unknown): SystemLogExport {
  return { sink: { writeSystemLog: () => { throw failure; } }, close: async () => {} };
}

describe('SystemLogOutput', () => {
  test('Given no export, when a record is written, then it goes to standard error only', () => {
    const spy = new OutputSpy();

    spy.output().writeSystemLog(info);

    assert.deepEqual(spy.writes, [['console', info]]);
  });

  test('Given a started export, when records are written, then each goes to standard error and then to the export, once each', () => {
    const spy = new OutputSpy();
    const output = spy.output();
    output.writeSystemLog(info);

    output.startExport(spy.exported());
    output.writeSystemLog(error);

    assert.deepEqual(spy.writes, [['console', info], ['console', error], ['export', error]]);
    assert.deepEqual(spy.failureLines, []);
  });

  test('Given an export sink that throws, when a record is written, then standard error still gets it, the write returns, and one failure line names the cause', () => {
    const spy = new OutputSpy();
    const output = spy.output();
    output.startExport(refusing(Object.assign(new Error('private detail of the refusal'), { code: 'ERR_SDK_REFUSED' })));

    assert.doesNotThrow(() => output.writeSystemLog(info));

    assert.deepEqual(spy.writes, [['console', info]]);
    assert.deepEqual(spy.failureLines, ['System log export failed: ERR_SDK_REFUSED. The records of that export are dropped.']);
  });

  test('Given a standard error that throws, when a record is written, then the failure escapes to the caller and the export does not get the record', () => {
    const spy = new OutputSpy();
    const output = new SystemLogOutput({ writeSystemLog: () => { throw new Error('EPIPE'); } }, { error: () => {} });
    output.startExport(spy.exported());

    assert.throws(() => output.writeSystemLog(info), /EPIPE/);
    assert.deepEqual(spy.writes, []);
  });

  test('Given two export failures in one minute, when they are reported, then standard error gets one failure line', () => {
    const spy = new OutputSpy();
    const output = spy.output();

    output.reportExportFailure(Object.assign(new Error('Internal Server Error'), { code: 500 }));
    spy.now = 59_999;
    output.reportExportFailure(Object.assign(new Error('Internal Server Error'), { code: 500 }));

    assert.deepEqual(spy.failureLines, ['System log export failed: HTTP 500. The records of that export are dropped.']);
  });

  test('Given a failure line, when another export fails one minute later, then standard error gets another line that counts the failures without a line', () => {
    const spy = new OutputSpy();
    const output = spy.output();
    output.reportExportFailure(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }));
    spy.now = 10_000;
    output.reportExportFailure(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }));
    spy.now = 20_000;
    output.reportExportFailure(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }));

    spy.now = 60_000;
    output.reportExportFailure(new Error('Request timed out'));
    spy.now = 120_000;
    output.reportExportFailure(new Error('Timeout'));

    assert.deepEqual(spy.failureLines, [
      'System log export failed: ECONNREFUSED. The records of that export are dropped.',
      'System log export failed: no answer in time. The records of that export are dropped. Failed exports since the last line: 2.',
      'System log export failed: no answer in time. The records of that export are dropped.',
    ]);
  });

  for (const [failure, cause] of [
    [Object.assign(new Error('Unauthorized: private token text'), { code: 401 }), 'HTTP 401'],
    [Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }), 'DEPTH_ZERO_SELF_SIGNED_CERT'],
    [Object.assign(new Error('private text'), { code: 'not a code: private text' }), 'Error'],
    [Object.assign(new TypeError('private text of a defect')), 'TypeError'],
    [new Error('Export failed with retryable status'), 'HTTP 429, 502, 503, or 504 after the retries'],
    ['a thrown string with private text', 'an unknown failure'],
  ] as const) {
    test(`Given an export failure ${JSON.stringify(cause)}, when it is reported, then the line names that cause and no message`, () => {
      const spy = new OutputSpy();

      spy.output().reportExportFailure(failure);

      assert.deepEqual(spy.failureLines, [`System log export failed: ${cause}. The records of that export are dropped.`]);
      assert.doesNotMatch(spy.failureLines.join('\n'), /private/);
    });
  }

  test('Given a started export, when the output closes, then it closes the export once, and a later record goes to standard error only', async () => {
    const spy = new OutputSpy();
    const output = spy.output();
    output.startExport(spy.exported());

    await output.close();
    await output.close();
    output.writeSystemLog(info);

    assert.deepEqual(spy.closes, ['export']);
    assert.deepEqual(spy.writes, [['console', info]]);
  });

  test('Given no export, when the output closes, then it resolves', async () => {
    await assert.doesNotReject(new OutputSpy().output().close());
  });

  test('Given an export whose stop does not end, when the output closes, then it waits 5 s, writes one failure line, and the stop goes on', { timeout: 2_000 }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const spy = new OutputSpy();
    const output = spy.output();
    output.startExport({ sink: spy.sink('export'), close: () => new Promise<void>(() => {}) });

    let closed = false;
    const closing = output.close().then(() => { closed = true; });
    await Promise.resolve();
    t.mock.timers.tick(4_999);
    await Promise.resolve();
    const closedBeforeBound = closed;
    t.mock.timers.tick(1);
    await closing;

    assert.equal(closedBeforeBound, false);
    assert.deepEqual(spy.failureLines, ['System log export failed: no end within the bound of 5 s at the stop. The records of that export are dropped.']);
  });

  test('Given an export whose stop fails, when the output closes, then the close resolves and one failure line names the cause', async () => {
    const spy = new OutputSpy();
    const output = spy.output();
    output.startExport({ sink: spy.sink('export'), close: () => Promise.reject(Object.assign(new Error('private detail'), { code: 'ECONNRESET' })) });

    await assert.doesNotReject(output.close());

    assert.deepEqual(spy.failureLines, ['System log export failed: ECONNRESET. The records of that export are dropped.']);
  });

  test('Given an export whose stop ends in time, when the output closes, then it writes no failure line and leaves no timer', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const spy = new OutputSpy();
    const output = spy.output();
    output.startExport(spy.exported());

    await output.close();
    t.mock.timers.tick(5_000);

    assert.deepEqual(spy.closes, ['export']);
    assert.deepEqual(spy.failureLines, []);
  });
});
