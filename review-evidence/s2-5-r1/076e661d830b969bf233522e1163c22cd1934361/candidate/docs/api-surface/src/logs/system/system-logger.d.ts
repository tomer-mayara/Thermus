export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3,
    FATAL = 4,
    NONE = 5
}
export type SystemLog = Pick<SystemLogger, 'info' | 'error'>;
export interface SystemLogRecord {
    readonly level: LogLevel;
    readonly time: string;
    readonly message: string;
}
export interface SystemLogSink {
    writeSystemLog(record: SystemLogRecord): void;
}
export declare class SystemLogger {
    private readonly sink;
    private level;
    private readonly loggerDirectory;
    constructor(sink: SystemLogSink, level?: LogLevel);
    setLevel(level: LogLevel): void;
    debug(message: string): void;
    info(message: string): void;
    warning(message: string): void;
    error(failure: unknown): void;
    fatal(failure: unknown): void;
    static messageOf(failure: unknown): string;
    private emit;
    private withCallSite;
    private callSite;
    private siteOfFrame;
    private placeOfFrame;
    private toPath;
    private formatTimestamp;
    private pad;
}
