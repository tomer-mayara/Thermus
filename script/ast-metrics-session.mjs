// The one-shot MCP session of script/ast-metrics-mcp.mjs. It is a module, not a command: it starts "ast-metrics mcp"
// in the repository root, makes the calls of one command run, and stops the server.
import { Client, ProtocolError } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { CommandError, notInstalled } from './repository.mjs';

const diagnosticStderrLimit = 2_000;

// ast-metrics answers each tool call with one text item. An error answer becomes the diagnostic of the command.
async function answerText(client, call, callOptions) {
  const result = await client.callTool(call, callOptions);
  const texts = result.content.filter((item) => item.type === 'text').map((item) => item.text);
  if (result.isError) throw new CommandError(`${call.name} failed: ${texts.join(' ')}`);
  if (result.content.length !== 1 || texts.length !== 1) throw new CommandError(`${call.name} gave an unexpected answer: expected one text item.`);
  return texts[0];
}

// The server runs in the root, because it analyzes the folder that it runs in.
class ServerProcess {
  #transport;
  #client = new Client({ name: 'thermus-ast-metrics-mcp', version: '0.0.0' });
  #stderr = '';
  #spawnError;
  #exit;

  constructor(root) {
    this.#transport = new StdioClientTransport({ command: 'ast-metrics', args: ['mcp'], cwd: root, env: process.env, stderr: 'pipe' });
    // Read all of stderr, so that a full pipe cannot stop the server. Keep the start of it for a diagnostic.
    this.#transport.stderr.setEncoding('utf8').on('data', (chunk) => { this.#stderr = (this.#stderr + chunk).slice(0, diagnosticStderrLimit); });
    // A failed start, such as ENOENT, also closes the transport. Keep its error, so that the diagnostic names it.
    this.#transport.onerror = (error) => { if (String(error?.syscall).startsWith('spawn')) this.#spawnError = error; };
    this.#exit = new Promise((_resolve, reject) => {
      this.#transport.onclose = () => reject(this.#spawnError ?? new CommandError(`ast-metrics exited before it answered. ${this.#stderrNote()}`));
    });
    // The exit after the answer is no failure.
    this.#exit.catch(() => undefined);
  }

  // The SDK waits without end for a write to a server that has exited, and its request timeout does not cover the
  // notifications/initialized message. So the exit of the server also ends the call.
  run(work, callOptions) {
    return Promise.race([this.#call(work, callOptions), this.#exit]);
  }

  async #call(work, callOptions) {
    await this.#client.connect(this.#transport, callOptions);
    return work({
      tool: (name, args) => answerText(this.#client, { name, arguments: args }, callOptions),
      tools: async () => (await this.#client.listTools(undefined, callOptions)).tools,
    });
  }

  failureOf(error) {
    if (error instanceof CommandError) return error;
    if (error?.code === 'ENOENT') return new CommandError(notInstalled);
    if (error instanceof ProtocolError) return new CommandError(`ast-metrics refused the request: ${error.message}`);
    return new CommandError(`The MCP call failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  #stderrNote() {
    const text = this.#stderr.trim();
    return text === '' ? 'It wrote nothing to stderr.' : `Its stderr: ${text}`;
  }

  // Closing the client closes the input of the server, and the server exits by itself. After a timeout the server
  // is still at work, so it gets SIGTERM first. The transport sends SIGTERM and then SIGKILL to a server that stays.
  async stop(now) {
    const pid = this.#transport.pid;
    if (now && pid !== null) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // The server exited in the meantime.
      }
    }
    await this.#client.close();
  }
}

// work gets { tool(name, args), tools() }: tool gives the answer text of a tool, and tools gives the tool list. The
// result of work is the result of the call. Each failure, also the end of the deadline, becomes a CommandError.
export async function withAstMetricsServer(root, timeoutMs, work) {
  const server = new ServerProcess(root);
  const timeout = new CommandError(`The call timed out after ${timeoutMs} ms. Increase --timeout-ms if needed.`);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(timeout), timeoutMs);
  const timedOut = new Promise((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(timeout), { once: true });
  });
  try {
    return await Promise.race([server.run(work, { signal: controller.signal, timeout: timeoutMs }), timedOut]);
  } catch (error) {
    throw controller.signal.aborted ? timeout : server.failureOf(error);
  } finally {
    clearTimeout(deadline);
    await server.stop(controller.signal.aborted);
  }
}
