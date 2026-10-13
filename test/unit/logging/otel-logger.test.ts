import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Logger, LogRecord } from '@opentelemetry/api-logs';
import { LogLevel } from '../../../src/logging/base-logger.ts';
import { OtelLogger } from '../../../src/logging/otel-logger.ts';

const levels = [
  { level: LogLevel.DEBUG, method: 'debug', severity: 5, label: 'DEBUG' },
  { level: LogLevel.INFO, method: 'info', severity: 9, label: 'INFO' },
  { level: LogLevel.WARNING, method: 'warning', severity: 13, label: 'WARNING' },
  { level: LogLevel.ERROR, method: 'error', severity: 17, label: 'ERROR' },
  { level: LogLevel.FATAL, method: 'fatal', severity: 21, label: 'FATAL' },
] as const;

function capture(level?: LogLevel): { logger: OtelLogger; records: LogRecord[] } {
  const records: LogRecord[] = [];
  const output: Pick<Logger, 'emit'> = { emit(record) { records.push(record); } };
  return { logger: new OtelLogger(output, level), records };
}

function logAll(logger: OtelLogger): void {
  for (const { method } of levels) logger[method](`${method} message`);
}

test('Given the default INFO threshold, when all levels are logged, then DEBUG is hidden', () => {
  const { logger, records } = capture();

  logAll(logger);

  assert.deepEqual(records.map((record) => record.severityText), ['INFO', 'WARNING', 'ERROR', 'FATAL']);
});

test('Given DEBUG threshold, when each method is called, then each record has its OpenTelemetry severity number and Thermus label', () => {
  const { logger, records } = capture(LogLevel.DEBUG);

  logAll(logger);

  assert.equal(records.length, levels.length);
  for (const [index, { method, severity, label }] of levels.entries()) {
    assert.equal(records[index].severityNumber, severity);
    assert.equal(records[index].severityText, label);
    assert.match(String(records[index].body), new RegExp(`^\\[otel-logger\\.test\\.(?:ts|js):\\d+\\]: ${method} message$`));
  }
});

for (const threshold of [...levels.map(({ level }) => level), LogLevel.NONE]) {
  test(`Given constructor threshold ${LogLevel[threshold]}, when all levels are logged, then only accepted levels are emitted`, () => {
    const { logger, records } = capture(threshold);

    logAll(logger);

    const accepted = levels.filter(({ level }) => level >= threshold);
    assert.deepEqual(records.map((record) => record.severityNumber), accepted.map(({ severity }) => severity));
  });
}

test('Given a logger, when setLevel changes its threshold through NONE and back to INFO, then each new threshold applies', () => {
  const { logger, records } = capture();

  for (const threshold of [...levels.map(({ level }) => level), LogLevel.NONE]) {
    logger.setLevel(threshold);
    records.length = 0;
    logAll(logger);

    const accepted = levels.filter(({ level }) => level >= threshold);
    assert.deepEqual(records.map((record) => record.severityNumber), accepted.map(({ severity }) => severity));
  }
  logger.setLevel(LogLevel.INFO);
  logger.info('logging resumes');

  assert.equal(records.length, 1);
  assert.equal(records[0].severityText, 'INFO');
  assert.match(String(records[0].body), /: logging resumes$/);
});

test('Given a caller and a message, when INFO is logged, then the body has the caller file and line with no console formatting', () => {
  const { logger, records } = capture();

  runInNewContext('logger.info("the call site")', { logger }, { filename: 'application-caller.js', lineOffset: 41 });

  assert.equal(records.length, 1);
  assert.equal(records[0].body, '[application-caller.js:42]: the call site');
});

test('Given an empty or Unicode multiline message, when INFO is logged, then the body keeps the message unchanged after its source', () => {
  const { logger, records } = capture();
  const messages = ['', 'שלום 🌡️\nsecond line'];

  for (const message of messages) {
    runInNewContext('logger.info(message)', { logger, message }, { filename: 'application-caller.js' });
  }

  assert.deepEqual(records.map((record) => record.body), messages.map((message) => `[application-caller.js:1]: ${message}`));
});
