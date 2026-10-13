import { BaseLogger, LogLevel } from './base-logger.js';
const reset = '\u001b[0m';
const levelColor = {
    [LogLevel.DEBUG]: '\u001b[36m',
    [LogLevel.INFO]: '\u001b[32m',
    [LogLevel.WARNING]: '\u001b[33m',
    [LogLevel.ERROR]: '\u001b[31m',
    [LogLevel.FATAL]: '\u001b[35m',
    [LogLevel.NONE]: '',
};
function paint(level, text) {
    const color = levelColor[level];
    if (color === '')
        return text;
    return `${color}${text}${reset}`;
}
// Stderr keeps stdout free for command output.
export class ConsoleLogger extends BaseLogger {
    output;
    constructor(level = LogLevel.INFO, output = process.stderr) {
        super(level);
        this.output = output;
    }
    write(level, time, message) {
        const label = paint(level, LogLevel[level]);
        this.output.write(`[${time}] ${label} ${message}\n`);
    }
}
//# sourceMappingURL=console-logger.js.map