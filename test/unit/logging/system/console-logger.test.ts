import assert from 'node:assert/strict';
import { basename } from 'node:path';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { SystemLogger, LogLevel } from '../../../../src/logs/system/system-logger.ts';
import { ConsoleSystemLogger } from '../../../../src/logs/system/console-system-logger.ts';

const ansi = '\u001b';
const testFile = basename(fileURLToPath(import.meta.url));
const timestamp = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] /;
const levels = [
  { level: LogLevel.DEBUG, method: 'debug', color: '36' },
  { level: LogLevel.INFO, method: 'info', color: '32' },
  { level: LogLevel.WARNING, method: 'warning', color: '33' },
  { level: LogLevel.ERROR, method: 'error', color: '31' },
  { level: LogLevel.FATAL, method: 'fatal', color: '35' },
] as const;

function capture(level?: LogLevel): {
  logger: ConsoleSystemLogger;
  written: string[];
} {
  const written: string[] = [];
  const output = new Writable({
    write(chunk, _encoding, done) {
      written.push(String(chunk));
      done();
    },
  });
  return { logger: new ConsoleSystemLogger(level, output), written };
}

function logAll(logger: ConsoleSystemLogger): void {
  for (const { method } of levels) logger[method](`${method} message`);
}

function callerLine(): number {
  const caller = (new Error().stack ?? '').split('\n').find((frame) => {
    return frame.includes(testFile) && !frame.includes('callerLine');
  });
  const found = /:(\d+):\d+/.exec(caller ?? '');
  assert.ok(found, 'The test caller must have a source line.');
  return Number(found[1]);
}

test('Given a default logger, when INFO is logged, then stderr receives one formatted line', (t) => {
  const written: string[] = [];
  t.mock.method(process.stderr, 'write', (chunk: unknown): boolean => {
    written.push(String(chunk));
    return true;
  });
  const logger = new ConsoleSystemLogger();

  logger.debug('hidden message');
  logger.info('This is a test log message');

  assert.equal(written.length, 1);
  assert.match(written[0], timestamp);
  assert.ok(written[0].includes(`${ansi}[32mINFO${ansi}[0m`));
  assert.ok(written[0].endsWith(': This is a test log message\n'));
});

test('Given a custom destination, when INFO is logged, then the call file and line are emitted once', () => {
  const { logger, written } = capture();

  const callLine = callerLine() + 1;
  logger.info('the call site');

  assert.equal(written.length, 1);
  assert.ok(written[0].includes(`[${testFile}:${callLine}]: the call site\n`));
});

test('Given a caller filename with parentheses, when INFO is logged, then the full filename is emitted', () => {
  const { logger, written } = capture();

  runInNewContext('logger.info("the call site")', { logger }, { filename: 'caller(logger).js' });

  assert.equal(written.length, 1);
  assert.ok(written[0].includes('[caller(logger).js:1]: the call site\n'));
});

test('Given a caller beside the system logging directory, when INFO is logged, then its location is emitted', () => {
  const { logger, written } = capture();
  // The VM caller checks the directory prefix; it is not a built production script.
  const filename = fileURLToPath(new URL('../../../../src/logs/system-caller.fixture', import.meta.url));

  runInNewContext('logger.info("the call site")', { logger }, { filename });

  assert.equal(written.length, 1);
  assert.ok(written[0].includes('[system-caller.fixture:1]: the call site\n'));
});

test('Given DEBUG threshold, when each method is called, then each level has its label and color', () => {
  const { logger, written } = capture(LogLevel.DEBUG);

  logAll(logger);

  assert.equal(written.length, levels.length);
  for (const [index, { level, method, color }] of levels.entries()) {
    const line = written[index];
    assert.match(line, timestamp);
    assert.ok(line.includes(`${ansi}[${color}m${LogLevel[level]}${ansi}[0m`));
    assert.ok(line.endsWith(`: ${method} message\n`));
  }
});

test('Given the default INFO threshold, when all levels are logged, then DEBUG is hidden', () => {
  const { logger, written } = capture();

  logAll(logger);

  assert.equal(written.length, 4);
  assert.deepEqual(written.map((line) => line.slice(line.lastIndexOf(']: ') + 3)), [
    'info message\n', 'warning message\n', 'error message\n', 'fatal message\n',
  ]);
});

for (const threshold of [...levels.map(({ level }) => level), LogLevel.NONE]) {
  test(`Given constructor threshold ${LogLevel[threshold]}, when all levels are logged, then only accepted levels are emitted`, () => {
    const { logger, written } = capture(threshold);

    logAll(logger);

    const accepted = levels.filter(({ level }) => level >= threshold);
    assert.equal(written.length, accepted.length);
    for (const [index, { method }] of accepted.entries()) {
      assert.ok(written[index].endsWith(`: ${method} message\n`));
    }
  });
}

test('Given a logger, when its threshold changes through all levels, then each new threshold applies', () => {
  const { logger, written } = capture();

  for (const threshold of [...levels.map(({ level }) => level), LogLevel.NONE]) {
    logger.setLevel(threshold);
    written.length = 0;
    logAll(logger);

    const accepted = levels.filter(({ level }) => level >= threshold);
    assert.equal(written.length, accepted.length);
    for (const [index, { method }] of accepted.entries()) {
      assert.ok(written[index].endsWith(`: ${method} message\n`));
    }
  }

  logger.setLevel(LogLevel.INFO);
  logger.info('logging resumes');
  assert.equal(written.length, 1);
  assert.ok(written[0].endsWith(': logging resumes\n'));
});

const cleanupAlsoFailed = ' The cleanup after this failure also failed: ';
const failures: ReadonlyArray<{ kind: string; failure: unknown; gives: string; text: string }> = [
  { kind: 'an Error', failure: new Error('The listen port is in use.'), gives: 'its message', text: 'The listen port is in use.' },
  {
    kind: 'a SuppressedError of a cleanup failure after a failure', gives: 'the failure and then the cleanup failure',
    failure: new SuppressedError(new Error('MCP cleanup failed'), new Error('The startup log failed')),
    text: `The startup log failed${cleanupAlsoFailed}MCP cleanup failed`,
  },
  {
    kind: 'a nested SuppressedError of two cleanup failures after a failure', gives: 'the three failures in the order they occurred',
    failure: new SuppressedError(new Error('Listener cleanup failed'), new SuppressedError(new Error('MCP cleanup failed'), new Error('The startup log failed'))),
    text: `The startup log failed${cleanupAlsoFailed}MCP cleanup failed${cleanupAlsoFailed}Listener cleanup failed`,
  },
  { kind: 'a number', failure: 42, gives: 'its text', text: '42' },
  { kind: 'a plain object', failure: { code: 'E_RENDERER' }, gives: 'its text', text: '[object Object]' },
  { kind: 'a string', failure: 'renderer stopped', gives: 'the string', text: 'renderer stopped' },
];

for (const { kind, failure, gives, text } of failures) {
  test(`Given ${kind}, when it is logged at ERROR and at FATAL, then each line gives ${gives} after the call site`, () => {
    const { logger, written } = capture();

    const errorLine = callerLine() + 1;
    logger.error(failure);
    const fatalLine = callerLine() + 1;
    logger.fatal(failure);

    assert.equal(written.length, 2);
    assert.ok(written[0].endsWith(`[${testFile}:${errorLine}]: ${text}\n`));
    assert.ok(written[1].endsWith(`[${testFile}:${fatalLine}]: ${text}\n`));
  });

  test(`Given ${kind}, when SystemLogger.messageOf() renders it, then it gives ${gives}`, () => {
    assert.equal(SystemLogger.messageOf(failure), text);
  });
}
