import { Readable } from 'node:stream';
import type { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { CommandError } from './repository.ts';

const diagnosticStderrLimit = 2_000;

// With stderr: 'pipe', the transport gives a PassThrough stream before the server starts.
function stderrOf(transport: StdioClientTransport): Readable {
  const { stderr } = transport;
  if (!(stderr instanceof Readable)) throw new Error('The stdio transport gave no stderr stream.');
  return stderr;
}

function stderrNote(stderr: string): string {
  const text = stderr.trim();
  return text === '' ? 'It wrote nothing to stderr.' : `Its stderr: ${text}`;
}

// The promise rejects when the transport closes. Call this before the client connects: the client keeps the handlers
// of the transport and calls them first.
export function exitOf(transport: StdioClientTransport): Promise<never> {
  let stderr = '';
  let spawnError: Error | undefined;
  // Read all of stderr, so that a full pipe cannot stop the server. Keep the start of it for a diagnostic.
  stderrOf(transport).setEncoding('utf8').on('data', (chunk: string) => { stderr = (stderr + chunk).slice(0, diagnosticStderrLimit); });
  // A failed start, such as ENOENT, also closes the transport. Keep its error, so that the diagnostic names it.
  transport.onerror = (error) => { if ('syscall' in error && String(error.syscall).startsWith('spawn')) spawnError = error; };
  const exit = new Promise<never>((_resolve, reject) => {
    transport.onclose = () => reject(spawnError ?? new CommandError(`ast-metrics exited before it answered. ${stderrNote(stderr)}`));
  });
  // The exit after the answer is no failure.
  exit.catch(() => undefined);
  return exit;
}
