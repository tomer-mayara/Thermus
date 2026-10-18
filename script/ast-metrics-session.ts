// The one-shot MCP session of script/ast-metrics-mcp.ts. It is a module, not a command: it starts "ast-metrics mcp"
// in the repository root, makes the calls of one command run, and stops the server.
import { ProtocolError } from '@modelcontextprotocol/client';
import type { AstMetricsWork } from './ast-metrics-server.ts';
import { ServerProcess } from './ast-metrics-server-process.ts';
import { CommandError, notInstalled } from './repository.ts';

function failureOf(error: unknown): CommandError {
  if (error instanceof CommandError) return error;
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return new CommandError(notInstalled);
  if (error instanceof ProtocolError) return new CommandError(`ast-metrics refused the request: ${error.message}`);
  return new CommandError(`The MCP call failed: ${error instanceof Error ? error.message : String(error)}`);
}

// Each failure, also the end of the deadline, becomes a CommandError.
export async function withAstMetricsServer<T>(root: string, timeoutMs: number, work: AstMetricsWork<T>): Promise<T> {
  const server = new ServerProcess(root);
  const timeout = new CommandError(`The call timed out after ${timeoutMs} ms. Increase --timeout-ms if needed.`);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(timeout), timeoutMs);
  const timedOut = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(timeout), { once: true });
  });
  try {
    return await Promise.race([server.run(work, { signal: controller.signal, timeout: timeoutMs }), timedOut]);
  } catch (error) {
    throw controller.signal.aborted ? timeout : failureOf(error);
  } finally {
    clearTimeout(deadline);
    await server.stop(controller.signal.aborted);
  }
}
