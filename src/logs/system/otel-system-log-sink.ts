import { SeverityNumber, type Logger } from '@opentelemetry/api-logs';
import { LogLevel, type SystemLogRecord, type SystemLogSink } from './system-logger.ts';

const severity: Record<LogLevel, SeverityNumber> = {
  [LogLevel.DEBUG]: SeverityNumber.DEBUG,
  [LogLevel.INFO]: SeverityNumber.INFO,
  [LogLevel.WARNING]: SeverityNumber.WARN,
  [LogLevel.ERROR]: SeverityNumber.ERROR,
  [LogLevel.FATAL]: SeverityNumber.FATAL,
  [LogLevel.NONE]: SeverityNumber.UNSPECIFIED,
};

export class OtelSystemLogSink implements SystemLogSink {
  constructor(private readonly output: Pick<Logger, 'emit'>) {}

  writeSystemLog({ level, message }: SystemLogRecord): void {
    this.output.emit({
      severityNumber: severity[level],
      severityText: LogLevel[level],
      body: message,
    });
  }
}
