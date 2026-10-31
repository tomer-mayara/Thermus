// The confirmation of each write of the fleet script: the plan of the write, then one answer. Only the exact answer
// yes lets the write go; another answer or the end of the input writes nothing.
import { createInterface } from 'node:readline';

export interface FleetIo {
  readonly input: NodeJS.ReadableStream;
  line(text: string): void;
  prompt(text: string): void;
}

export const processIo: FleetIo = {
  input: process.stdin,
  line: (text) => { process.stdout.write(`${text}\n`); },
  prompt: (text) => { process.stdout.write(text); },
};

export async function confirmed(io: FleetIo, plan: readonly string[]): Promise<boolean> {
  for (const text of plan) io.line(text);
  io.prompt('Type yes to go on: ');
  const lines = createInterface({ input: io.input, terminal: false });
  const answer = await new Promise<string | undefined>((resolve) => {
    lines.once('line', resolve);
    lines.once('close', () => resolve(undefined));
  });
  lines.close();
  if (answer?.trim() === 'yes') return true;
  io.line('No yes: nothing changed.');
  return false;
}
