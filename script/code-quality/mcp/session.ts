// The one-shot MCP session of the ast-metrics commands. It is a module, not a command: it starts "ast-metrics mcp"
// in the repository root, makes the calls of one command run, and stops the server.
import { ProtocolError } from '@modelcontextprotocol/client';
import type { AstMetricsWork } from './server.ts';
import { ServerProcess } from './server-process.ts';
import type { ToolVersionPolicy } from '../shared/tool-version.ts';
import { CommandError, notInstalled } from '../shared/repository.ts';

function failureOf(error: unknown): CommandError {
  if (error instanceof CommandError) return error;
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return new CommandError(notInstalled);
  if (error instanceof ProtocolError) return new CommandError(`ast-metrics refused the request: ${error.message}`);
  return new CommandError(`The MCP call failed: ${error instanceof Error ? error.message : String(error)}`);
}

// The repository root, which the server analyzes, or the root and the one folder in it that the server analyzes.
export type AnalyzedTree = string | ({ readonly root: string; readonly folder?: string } & ToolVersionPolicy);

// Each failure, also the end of the deadline, becomes a CommandError.
export async function withAstMetricsServer<T>(tree: AnalyzedTree, timeoutMs: number, work: AstMetricsWork<T>): Promise<T> {
  const server = typeof tree === 'string' ? new ServerProcess(tree) : new ServerProcess(tree.root, tree.folder);
  const timeout = new CommandError(`The call timed out after ${timeoutMs} ms. Increase --timeout-ms if needed.`);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(timeout), timeoutMs);
  const timedOut = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(timeout), { once: true });
  });
  try {
    return await Promise.race([server.run(work, { signal: controller.signal, timeout: timeoutMs }, typeof tree === 'string' ? {} : tree), timedOut]);
  } catch (error) {
    throw controller.signal.aborted ? timeout : failureOf(error);
  } finally {
    clearTimeout(deadline);
    await server.stop(controller.signal.aborted);
  }
}
