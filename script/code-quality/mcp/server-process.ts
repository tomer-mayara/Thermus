import { Readable } from 'node:stream';
import { Client, type RequestOptions } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { checkServerToolVersion, type ToolVersionPolicy } from '../shared/tool-version.ts';
import { CommandError } from '../shared/repository.ts';
import { serverOf, type AstMetricsWork } from './server.ts';
import { astMetricsBinary } from '../shared/tool-runtime.ts';

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
function exitOf(transport: StdioClientTransport): Promise<never> {
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

// The server gets the environment of the command. The type of process.env allows undefined values, but
// Object.entries gives none, so the filter only narrows the type.
function commandEnvironment(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

function terminate(pid: number | null): void {
  if (pid === null) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // The server exited in the meantime.
  }
}

// The server runs in the root, and the paths of the calls are paths from the root. Without a folder, the server
// analyzes the root; a folder, such as src, limits the analysis to that folder. The default gives no folder argument,
// because with "." get_file_metrics answers each path as an absolute path.
export class ServerProcess {
  readonly #transport: StdioClientTransport;
  readonly #client = new Client({ name: 'thermus-ast-metrics-mcp', version: '0.0.0' });
  readonly #exit: Promise<never>;

  constructor(root: string, folder?: string, binary = astMetricsBinary()) {
    const args = folder === undefined ? ['mcp'] : ['mcp', folder];
    this.#transport = new StdioClientTransport({ command: binary, args, cwd: root, env: commandEnvironment(), stderr: 'pipe' });
    this.#exit = exitOf(this.#transport);
  }

  // The SDK waits without end for a write to a server that has exited, and its request timeout does not cover the
  // notifications/initialized message. So the exit of the server also ends the call.
  run<T>(work: AstMetricsWork<T>, callOptions: RequestOptions, policy: ToolVersionPolicy): Promise<T> {
    return Promise.race([this.#call(work, callOptions, policy), this.#exit]);
  }

  async #call<T>(work: AstMetricsWork<T>, callOptions: RequestOptions, policy: ToolVersionPolicy): Promise<T> {
    await this.#client.connect(this.#transport, callOptions);
    checkServerToolVersion(this.#client.getServerVersion()?.version, policy);
    return work(serverOf(this.#client, callOptions));
  }

  // Closing the client closes the input of the server, and the server exits by itself. After a timeout the server
  // is still at work, so it gets SIGTERM first. The transport sends SIGTERM and then SIGKILL to a server that stays.
  async stop(now: boolean): Promise<void> {
    if (now) terminate(this.#transport.pid);
    await this.#client.close();
  }
}
