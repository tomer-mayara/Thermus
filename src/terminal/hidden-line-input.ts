import { createInterface, type Interface } from 'node:readline';
import { type Readable, Writable } from 'node:stream';

type TerminalOrPipe = Readable & { readonly isTTY?: boolean };

interface PipedLines {
  readonly reader: Interface;
  readonly lines: AsyncIterator<string, undefined>;
}

export class HiddenLineInput {
  private piped: PipedLines | undefined;

  constructor(
    private readonly input: TerminalOrPipe,
    private readonly prompts: Writable,
  ) {}

  async readHiddenLine(prompt: string): Promise<string | undefined> {
    this.prompts.write(prompt);
    try {
      if (this.input.isTTY === true) return await readTerminalLine(this.input);
      return await this.readPipedLine();
    } finally {
      this.prompts.write('\n');
    }
  }

  close(): void {
    this.piped?.reader.close();
  }

  // One interface for all reads: its iterator keeps the lines that arrive in one chunk.
  private async readPipedLine(): Promise<string | undefined> {
    this.piped ??= pipedLines(this.input);
    const next = await this.piped.lines.next();
    return next.done === true ? undefined : next.value;
  }
}

// Raw mode lasts only while a prompt waits, so a Ctrl-C at other times stops the process.
// Without a 'SIGINT' listener, readline closes the interface on Ctrl-C and on Ctrl-D.
function readTerminalLine(input: Readable): Promise<string | undefined> {
  // A new interface does not get an 'end' that the input sent before.
  if (!input.readable) return Promise.resolve(undefined);
  const reader = lineReader(input, true);
  return new Promise<string | undefined>((resolve, reject) => {
    reader.once('line', resolve);
    reader.once('close', () => resolve(undefined));
    reader.once('error', reject);
  }).finally(() => reader.close());
}

function pipedLines(input: Readable): PipedLines {
  const reader = lineReader(input, false);
  return { reader, lines: reader[Symbol.asyncIterator]() };
}

// The muted output gets the echo and the escape sequences, and no line stays in history.
function lineReader(input: Readable, terminal: boolean): Interface {
  const output = new Writable({ write: (_chunk, _encoding, done) => done() });
  return createInterface({ input, output, terminal, historySize: 0 });
}
