import { SeverityNumber, type Logger } from '@opentelemetry/api-logs';
import { SystemLogger, LogLevel } from './system-logger.ts';

const severity: Record<LogLevel, SeverityNumber> = {
  [LogLevel.DEBUG]: SeverityNumber.DEBUG,
  [LogLevel.INFO]: SeverityNumber.INFO,
  [LogLevel.WARNING]: SeverityNumber.WARN,
  [LogLevel.ERROR]: SeverityNumber.ERROR,
  [LogLevel.FATAL]: SeverityNumber.FATAL,
  [LogLevel.NONE]: SeverityNumber.UNSPECIFIED,
};

export class OtelSystemLogger extends SystemLogger {
  constructor(
    private readonly output: Pick<Logger, 'emit'>,
    level: LogLevel = LogLevel.INFO,
  ) {
    super(level);
  }

  protected override write(
    level: LogLevel,
    _time: string,
    message: string,
  ): void {
    this.output.emit({
      severityNumber: severity[level],
      severityText: LogLevel[level],
      body: message,
    });
  }
}
