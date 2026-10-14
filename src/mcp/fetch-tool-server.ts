import { ProtocolError, ProtocolErrorCode, Server, type CallToolRequest, type CallToolResult, type ServerContext } from '@modelcontextprotocol/server';
import type { RequestContext } from '../auth/access-context.ts';
import type { BaseLogger } from '../logging/base-logger.ts';
import { fetchToolInputSchema, parseFetchToolArguments } from './fetch-tool-schema.ts';
import type { FetchOperation } from './get-url-as-markdown.ts';
import { formatToolCompletion, type CompletionStatus } from './tool-completion-record.ts';
import type { McpRequestLifetime } from './mcp-server.ts';

export function createFetchToolServer(context: RequestContext, dependencies: {
  operation: FetchOperation;
  logger: Pick<BaseLogger, 'info' | 'error'>;
}, lifetime?: McpRequestLifetime): Server {
  const server = new Server({ name: 'thermus', version: '0.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler('tools/list', () => ({ tools: [{
    name: 'getURLAsMarkdown',
    description: 'Fetch a web page as Markdown. Give the reason the agent needs the page.',
    inputSchema: fetchToolInputSchema,
  }] }));
  const callTool = async (request: CallToolRequest, requestContext: ServerContext) => {
    const startedAt = performance.now();
    const call = request.params;
    const signal = lifetime === undefined ? requestContext.mcpReq.signal : AbortSignal.any([requestContext.mcpReq.signal, lifetime.signal]);
    let status: CompletionStatus = 'processing_failed';
    try {
      if (call.name !== 'getURLAsMarkdown') {
        status = 'unknown_tool';
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Unknown tool');
      }
      const args = await parseFetchToolArguments(call.arguments);
      if (args === undefined) throw new Error('Invalid tool arguments');
      signal.throwIfAborted();
      const markdown = await dependencies.operation(args.url, context, signal);
      signal.throwIfAborted();
      if (typeof markdown !== 'string') throw new Error('Page processing failed');
      status = 'success';
      return server.projectCallToolResult({ content: [{ type: 'text', text: markdown }] }, undefined);
    } catch (error) {
      if (status === 'unknown_tool') throw error;
      const failure = safeFailure(error, signal);
      status = failure.status;
      const result: CallToolResult = { content: [{ type: 'text', text: failure.message }], isError: true };
      return server.projectCallToolResult(result, undefined);
    } finally {
      emitCompletion(dependencies.logger, formatToolCompletion(context, {
        name: call.name, arguments: call.arguments, status, durationMs: Math.max(0, performance.now() - startedAt),
      }));
    }
  };
  server.setRequestHandler('tools/call', (request, requestContext) => {
    const task = callTool(request, requestContext);
    return lifetime?.track(task) ?? task;
  });
  return server;
}

function safeFailure(error: unknown, signal: AbortSignal): { status: CompletionStatus; message: string } {
  if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) return { status: 'cancelled', message: 'Request cancelled' };
  const failures = {
    'Invalid tool arguments': 'invalid_arguments',
    'Access denied': 'access_denied',
    'Page fetch failed': 'fetch_failed',
    'Page processing failed': 'processing_failed',
  } as const;
  if (error instanceof Error && Object.hasOwn(failures, error.message)) {
    const message = error.message as keyof typeof failures;
    return { status: failures[message], message };
  }
  return { status: 'processing_failed', message: 'Page processing failed' };
}

function emitCompletion(logger: Pick<BaseLogger, 'info' | 'error'>, record: string): void {
  try {
    logger.info(record);
  } catch {
    try {
      logger.error(record);
    } catch {
      // Completion records are best effort. Logging cannot change a tool result.
    }
  }
}
