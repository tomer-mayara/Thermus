import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
export class HiddenLineInput {
    input;
    prompts;
    piped;
    constructor(input, prompts) {
        this.input = input;
        this.prompts = prompts;
    }
    async readHiddenLine(prompt) {
        this.prompts.write(prompt);
        try {
            if (this.input.isTTY === true)
                return await readTerminalLine(this.input);
            return await this.readPipedLine();
        }
        finally {
            this.prompts.write('\n');
        }
    }
    close() {
        this.piped?.reader.close();
    }
    // One interface for all reads: its iterator keeps the lines that arrive in one chunk.
    async readPipedLine() {
        this.piped ??= pipedLines(this.input);
        const next = await this.piped.lines.next();
        return next.done === true ? undefined : next.value;
    }
}
// Raw mode lasts only while a prompt waits, so a Ctrl-C at other times stops the process.
// Without a 'SIGINT' listener, readline closes the interface on Ctrl-C and on Ctrl-D.
function readTerminalLine(input) {
    // A new interface does not get an 'end' that the input sent before.
    if (!input.readable)
        return Promise.resolve(undefined);
    const reader = lineReader(input, true);
    return new Promise((resolve, reject) => {
        reader.once('line', resolve);
        reader.once('close', () => resolve(undefined));
        reader.once('error', reject);
    }).finally(() => reader.close());
}
function pipedLines(input) {
    const reader = lineReader(input, false);
    return { reader, lines: reader[Symbol.asyncIterator]() };
}
// The muted output gets the echo and the escape sequences, and no line stays in history.
function lineReader(input, terminal) {
    const output = new Writable({ write: (_chunk, _encoding, done) => done() });
    return createInterface({ input, output, terminal, historySize: 0 });
}
//# sourceMappingURL=hidden-line-input.js.map