import '../../support/deny-network.ts';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import type { Logger, LogRecord } from '@opentelemetry/api-logs';
import { LogLevel } from '../../../src/logging/base-logger.ts';
import { WorkSliceLogger } from '../../support/work-slice/work-slice-logger.ts';

const levels = [
  { level: LogLevel.DEBUG, method: 'debug', severity: 5, label: 'DEBUG' },
  { level: LogLevel.INFO, method: 'info', severity: 9, label: 'INFO' },
  { level: LogLevel.WARNING, method: 'warning', severity: 13, label: 'WARNING' },
  { level: LogLevel.ERROR, method: 'error', severity: 17, label: 'ERROR' },
  { level: LogLevel.FATAL, method: 'fatal', severity: 21, label: 'FATAL' },
] as const;
const timestamp = String.raw`\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]`;
const callSite = String.raw`\[work-slice-logger\.test\.(?:ts|js):\d+\]`;

interface Capture {
  readonly logger: WorkSliceLogger;
  readonly lines: string[];
  readonly records: LogRecord[];
}

function capture(level?: LogLevel): Capture {
  const lines: string[] = [];
  const records: LogRecord[] = [];
  const output: Pick<Logger, 'emit'> = { emit(record) { records.push(record); } };
  const consoleStream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  return { logger: new WorkSliceLogger(output, consoleStream, level), lines, records };
}

function logAll(logger: WorkSliceLogger): void {
  for (const { method } of levels) logger[method](`${method} message`);
}

function labelOf(line: string): string | undefined {
  return /^\[[^\]]*\] (\S+) /.exec(line)?.[1];
}

test('Given a console stream and an OpenTelemetry output, when INFO is logged, then the console gets one plain line and the output gets one record, both with the call site of the caller', () => {
  const { logger, lines, records } = capture();

  logger.info('hello');

  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] INFO \[work-slice-logger\.test\.(?:ts|js):\d+\]: hello\n$/);
  assert.equal(records.length, 1);
  assert.equal(records[0].severityNumber, 9);
  assert.equal(records[0].severityText, 'INFO');
  assert.match(String(records[0].body), /^\[work-slice-logger\.test\.(?:ts|js):\d+\]: hello$/);
  assert.ok(lines[0].endsWith(` INFO ${String(records[0].body)}\n`), 'The console line and the record must have the same call site.');
});

test('Given the DEBUG threshold, when each method is called, then each console line has its level label and each record has its OpenTelemetry severity number and label', () => {
  const { logger, lines, records } = capture(LogLevel.DEBUG);

  logAll(logger);

  assert.equal(lines.length, levels.length);
  assert.equal(records.length, levels.length);
  for (const [index, { method, severity, label }] of levels.entries()) {
    assert.match(lines[index], new RegExp(`^${timestamp} ${label} ${callSite}: ${method} message\\n$`));
    assert.equal(records[index].severityNumber, severity);
    assert.equal(records[index].severityText, label);
    assert.match(String(records[index].body), new RegExp(`^${callSite}: ${method} message$`));
  }
});

test('Given the default INFO threshold, when all levels are logged, then DEBUG is hidden from the console and from the output', () => {
  const { logger, lines, records } = capture();

  logAll(logger);

  assert.deepEqual(lines.map(labelOf), ['INFO', 'WARNING', 'ERROR', 'FATAL']);
  assert.deepEqual(records.map((record) => record.severityText), ['INFO', 'WARNING', 'ERROR', 'FATAL']);
});

test('Given a logger, when setLevel changes its threshold through all levels and NONE, then each new threshold applies to the console and to the output', () => {
  const { logger, lines, records } = capture();

  for (const threshold of [...levels.map(({ level }) => level), LogLevel.NONE]) {
    logger.setLevel(threshold);
    lines.length = 0;
    records.length = 0;
    logAll(logger);

    const accepted = levels.filter(({ level }) => level >= threshold).map(({ label }) => label);
    assert.deepEqual(lines.map(labelOf), accepted);
    assert.deepEqual(records.map((record) => record.severityText), accepted);
  }
});

test('Given no console stream, when INFO is logged, then stderr gets the line', (t) => {
  const written: string[] = [];
  t.mock.method(process.stderr, 'write', (chunk: unknown): boolean => {
    written.push(String(chunk));
    return true;
  });
  const records: LogRecord[] = [];
  const logger = new WorkSliceLogger({ emit(record) { records.push(record); } });

  logger.info('to stderr');

  assert.equal(written.length, 1);
  assert.match(written[0], new RegExp(`^${timestamp} INFO ${callSite}: to stderr\\n$`));
  assert.equal(records.length, 1);
});
