import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { LogLevel, SystemLogger, type SystemLogRecord, type SystemLogSink } from '../../../../src/logs/system/system-logger.ts';

test('Given an injected system sink, when an admitted call returns, then the sink has received one prepared record with the original caller', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 0, 2, 3, 4, 5).getTime() });
  const records: SystemLogRecord[] = [];
  const sink: SystemLogSink = { writeSystemLog(record) { records.push(record); } };
  const logger = new SystemLogger(sink);

  runInNewContext('logger.info("the server started")', { logger }, { filename: 'application-caller.js', lineOffset: 41 });

  assert.deepEqual(records, [{ level: LogLevel.INFO, time: '2026-01-02 03:04:05', message: '[application-caller.js:42]: the server started' }]);
});
