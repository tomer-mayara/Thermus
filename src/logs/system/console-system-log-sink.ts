import type { Writable } from 'node:stream';
import { LogLevel, type SystemLogRecord, type SystemLogSink } from './system-logger.ts';

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
export class ConsoleSystemLogSink implements SystemLogSink {
  constructor(private readonly output: Writable = process.stderr) {}

  writeSystemLog({ level, time, message }: SystemLogRecord): void {
    const label: string = paint(level, LogLevel[level]);
    this.output.write(`[${time}] ${label} ${message}\n`);
  }
}
