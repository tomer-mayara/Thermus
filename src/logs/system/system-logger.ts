import { basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export enum LogLevel {
  DEBUG,
  INFO,
  WARNING,
  ERROR,
  FATAL,
  NONE,
}

export type SystemLog = Pick<SystemLogger, 'info' | 'error'>;

export abstract class SystemLogger {
  private level: LogLevel;
  private readonly loggerDirectory: string = import.meta.dirname;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string): void {
    this.emit(LogLevel.DEBUG, message);
  }

  info(message: string): void {
    this.emit(LogLevel.INFO, message);
  }

  warning(message: string): void {
    this.emit(LogLevel.WARNING, message);
  }

  error(failure: unknown): void {
    this.emit(LogLevel.ERROR, failure);
  }

  fatal(failure: unknown): void {
    this.emit(LogLevel.FATAL, failure);
  }

  // This rule is here so that each logger writes a failure in the same way.
  // A caller that makes a longer line uses the same rule.
  public static messageOf(failure: unknown): string {
    if (failure instanceof SuppressedError) {
      return `${SystemLogger.messageOf(failure.suppressed)} The cleanup after this failure also failed: ${SystemLogger.messageOf(failure.error)}`;
    }
    return failure instanceof Error ? failure.message : String(failure);
  }

  private emit(level: LogLevel, message: unknown): void {
    if (level < this.level) return;
    this.write(
      level,
      this.formatTimestamp(new Date()),
      this.withCallSite(SystemLogger.messageOf(message)),
    );
  }

  private withCallSite(message: string): string {
    const site = this.callSite();
    if (site === '') return message;
    return `[${site}]: ${message}`;
  }

  private callSite(): string {
    const previousLimit = Error.stackTraceLimit;
    try {
      Error.stackTraceLimit = 8;
      const frames = (new Error().stack ?? '').split('\n');
      for (const frame of frames) {
        const site = this.siteOfFrame(frame);
        if (site !== '') return site;
      }
      return '';
    } catch {
      return '';
    } finally {
      Error.stackTraceLimit = previousLimit;
    }
  }

  private siteOfFrame(frame: string): string {
    const place = this.placeOfFrame(frame);
    if (place === '' || place.startsWith('node:')) return '';
    const match = /^(.*):(\d+):\d+$/.exec(place);
    const file = match?.[1];
    const line = match?.[2];
    if (file === undefined || line === undefined) return '';
    const path = this.toPath(file);
    if (path.startsWith(`${this.loggerDirectory}${sep}`)) return '';
    return `${basename(path)}:${line}`;
  }

  private placeOfFrame(frame: string): string {
    const text = frame.trim();
    if (!text.startsWith('at ')) return '';
    const rest = text.slice(3);
    if (!rest.endsWith(')')) return rest;
    const open = rest.indexOf(' (');
    if (open === -1) return rest;
    return rest.slice(open + 2, -1);
  }

  private toPath(file: string): string {
    if (!file.startsWith('file://')) return file;
    try {
      return fileURLToPath(file);
    } catch {
      return file;
    }
  }

  private formatTimestamp(now: Date): string {
    const date = [
      now.getFullYear(),
      this.pad(now.getMonth() + 1),
      this.pad(now.getDate()),
    ].join('-');
    const time = [
      this.pad(now.getHours()),
      this.pad(now.getMinutes()),
      this.pad(now.getSeconds()),
    ].join(':');
    return `${date} ${time}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  protected abstract write(
    level: LogLevel,
    time: string,
    message: string,
  ): void;
}
