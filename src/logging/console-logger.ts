import type { Writable } from 'node:stream';
import { BaseLogger, LogLevel } from './base-logger.ts';

const reset = '\u001b[0m';

const levelColor: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '\u001b[36m',
  [LogLevel.INFO]: '\u001b[32m',
  [LogLevel.WARNING]: '\u001b[33m',
  [LogLevel.ERROR]: '\u001b[31m',
  [LogLevel.FATAL]: '\u001b[35m',
  [LogLevel.NONE]: '',
};

function paint(level: LogLevel, text: string): string {
  const color: string = levelColor[level];
  if (color === '') return text;
  return `${color}${text}${reset}`;
}

// Stderr keeps stdout free for command output.
export class ConsoleLogger extends BaseLogger {
  constructor(
    level: LogLevel = LogLevel.INFO,
    private readonly output: Writable = process.stderr,
  ) {
    super(level);
  }

  protected override write(
    level: LogLevel,
    time: string,
    message: string,
  ): void {
    const label: string = paint(level, LogLevel[level]);
    this.output.write(`[${time}] ${label} ${message}\n`);
  }
}
