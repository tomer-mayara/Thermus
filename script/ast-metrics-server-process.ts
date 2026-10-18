import { Client, type RequestOptions } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { exitOf } from './ast-metrics-server-exit.ts';
import { serverOf, type AstMetricsWork } from './ast-metrics-server.ts';

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

// The server runs in the root, because it analyzes the folder that it runs in.
export class ServerProcess {
  readonly #transport: StdioClientTransport;
  readonly #client = new Client({ name: 'thermus-ast-metrics-mcp', version: '0.0.0' });
  readonly #exit: Promise<never>;

  constructor(root: string) {
    this.#transport = new StdioClientTransport({ command: 'ast-metrics', args: ['mcp'], cwd: root, env: commandEnvironment(), stderr: 'pipe' });
    this.#exit = exitOf(this.#transport);
  }

  // The SDK waits without end for a write to a server that has exited, and its request timeout does not cover the
  // notifications/initialized message. So the exit of the server also ends the call.
  run<T>(work: AstMetricsWork<T>, callOptions: RequestOptions): Promise<T> {
    return Promise.race([this.#call(work, callOptions), this.#exit]);
  }

  async #call<T>(work: AstMetricsWork<T>, callOptions: RequestOptions): Promise<T> {
    await this.#client.connect(this.#transport, callOptions);
    return work(serverOf(this.#client, callOptions));
  }

  // Closing the client closes the input of the server, and the server exits by itself. After a timeout the server
  // is still at work, so it gets SIGTERM first. The transport sends SIGTERM and then SIGKILL to a server that stays.
  async stop(now: boolean): Promise<void> {
    if (now) terminate(this.#transport.pid);
    await this.#client.close();
  }
}
