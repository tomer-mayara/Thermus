import { basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARNING"] = 2] = "WARNING";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
    LogLevel[LogLevel["NONE"] = 5] = "NONE";
})(LogLevel || (LogLevel = {}));
export class BaseLogger {
    level;
    loggerDirectory = import.meta.dirname;
    constructor(level = LogLevel.INFO) {
        this.level = level;
    }
    setLevel(level) {
        this.level = level;
    }
    debug(message) {
        this.emit(LogLevel.DEBUG, message);
    }
    info(message) {
        this.emit(LogLevel.INFO, message);
    }
    warning(message) {
        this.emit(LogLevel.WARNING, message);
    }
    error(message) {
        this.emit(LogLevel.ERROR, message);
    }
    fatal(message) {
        this.emit(LogLevel.FATAL, message);
    }
    emit(level, message) {
        if (level < this.level)
            return;
        this.write(level, this.formatTimestamp(new Date()), this.withCallSite(message));
    }
    withCallSite(message) {
        const site = this.callSite();
        if (site === '')
            return message;
        return `[${site}]: ${message}`;
    }
    callSite() {
        const previousLimit = Error.stackTraceLimit;
        try {
            Error.stackTraceLimit = 8;
            const frames = (new Error().stack ?? '').split('\n');
            for (const frame of frames) {
                const site = this.siteOfFrame(frame);
                if (site !== '')
                    return site;
            }
            return '';
        }
        catch {
            return '';
        }
        finally {
            Error.stackTraceLimit = previousLimit;
        }
    }
    siteOfFrame(frame) {
        const place = this.placeOfFrame(frame);
        if (place === '' || place.startsWith('node:'))
            return '';
        const match = /^(.*):(\d+):\d+$/.exec(place);
        const file = match?.[1];
        const line = match?.[2];
        if (file === undefined || line === undefined)
            return '';
        const path = this.toPath(file);
        if (path.startsWith(`${this.loggerDirectory}${sep}`))
            return '';
        return `${basename(path)}:${line}`;
    }
    placeOfFrame(frame) {
        const text = frame.trim();
        if (!text.startsWith('at '))
            return '';
        const rest = text.slice(3);
        if (!rest.endsWith(')'))
            return rest;
        const open = rest.indexOf(' (');
        if (open === -1)
            return rest;
        return rest.slice(open + 2, -1);
    }
    toPath(file) {
        if (!file.startsWith('file://'))
            return file;
        try {
            return fileURLToPath(file);
        }
        catch {
            return file;
        }
    }
    formatTimestamp(now) {
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
    pad(value) {
        return String(value).padStart(2, '0');
    }
}
//# sourceMappingURL=base-logger.js.map