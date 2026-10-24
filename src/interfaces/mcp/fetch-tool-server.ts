import type { AuditLog, ToolCompletion } from '../../logs/audit/audit-log.ts';
import type { SystemLog } from '../../logs/system/system-logger.ts';
import { randomUUID } from 'node:crypto';
import { ProtocolError, ProtocolErrorCode, Server, type CallToolRequest, type CallToolResult, type ServerContext } from '@modelcontextprotocol/server';
import type { RequestContext } from '../../accounts/identity/access-context.ts';
import { SearchFailure } from '../../pipelines/search/search-failure.ts';
import { projectSearchOutcome, type SearchOperation } from './search.ts';
import { searchToolInputSchema, parseSearchToolArguments } from './search-tool-schema.ts';
import { fetchToolInputSchema, parseFetchToolArguments } from './fetch-tool-schema.ts';
import type { FetchOperation } from './get-url-as-markdown.ts';
import { formatToolCompletion, type CompletionStatus } from './tool-completion-record.ts';
import type { McpRequestLifetime } from './mcp-server.ts';
import { PageFetchFailure } from '../../pipelines/page-fetch/fetch-failure.ts';

export interface ToolOperations {
  readonly fetch: FetchOperation;
  readonly search: SearchOperation;
}

export function createFetchToolServer(context: RequestContext, dependencies: {
  operations: ToolOperations;
  logger: SystemLog;
  audit?: Pick<AuditLog, 'toolCompleted'>;
}, lifetime?: McpRequestLifetime): Server {
  const server = new Server({ name: 'thermus', version: '0.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler('tools/list', () => ({ tools: [{
    name: 'getURLAsMarkdown',
    description: 'Fetch a known web page URL as Markdown. For web searches, use search instead of fetching a search engine results URL. Give the reason the agent needs the page.',
    inputSchema: fetchToolInputSchema,
  }, {
    name: 'search',
    description: 'Search the web with a text query and return cleaned results as Markdown. Use this tool for web searches; search engines may block generic page-fetch requests. Use getURLAsMarkdown to read a result page. Give the reason the agent needs the search.',
    inputSchema: searchToolInputSchema,
  }] }));
  const callTool = async (request: CallToolRequest, requestContext: ServerContext) => {
    const operationId = randomUUID();
    const startedAt = performance.now();
    const call = request.params;
    const signal = lifetime === undefined ? requestContext.mcpReq.signal : AbortSignal.any([requestContext.mcpReq.signal, lifetime.signal]);
    let status: CompletionStatus = 'processing_failed';
    let validated: { tool: 'search'; input: { query: string; reason: string } } | { tool: 'getURLAsMarkdown'; input: { url: string; reason: string } } | undefined;
    let projected: CallToolResult | undefined;
    try {
      if (call.name === 'search') {
        const args = await parseSearchToolArguments(call.arguments);
        if (args === undefined) throw new Error('Invalid tool arguments');
        validated = { tool: 'search', input: { query: args.query, reason: args.reason } };
        signal.throwIfAborted();
        const outcome = await dependencies.operations.search(args.query, context, { signal, operationId });
        signal.throwIfAborted();
        const result = projectSearchOutcome(outcome);
        status = result.isError ? 'withheld' : 'success';
        return projected = server.projectCallToolResult(result, undefined);
      }
      if (call.name !== 'getURLAsMarkdown') {
        status = 'unknown_tool';
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Unknown tool');
      }
      const args = await parseFetchToolArguments(call.arguments);
      if (args === undefined) throw new Error('Invalid tool arguments');
      validated = { tool: 'getURLAsMarkdown', input: { url: args.url, reason: args.reason } };
      signal.throwIfAborted();
      const markdown = await dependencies.operations.fetch(args.url, context, { signal, operationId });
      signal.throwIfAborted();
      if (typeof markdown !== 'string') throw new Error('Page processing failed');
      status = 'success';
      return projected = server.projectCallToolResult({ content: [{ type: 'text', text: markdown }] }, undefined);
    } catch (error) {
      if (status === 'unknown_tool') throw error;
      const failure = safeFailure(error, signal, call.name === 'search');
      status = failure.status;
      const result: CallToolResult = { content: [{ type: 'text', text: failure.message }], isError: true };
      return projected = server.projectCallToolResult(result, undefined);
    } finally {
      const durationMs = Math.max(0, performance.now() - startedAt);
      if (dependencies.audit !== undefined && validated !== undefined && projected !== undefined && status !== 'invalid_arguments' && status !== 'unknown_tool') {
        captureCompletion(dependencies.audit, {
          ...validated, timestamp: new Date().toISOString(), organizationId: context.tenantId,
          actor: { authority: context.user.authority, subject: context.user.subject },
          operationId, status, durationMs,
          result: projected.content.filter((entry) => entry.type === 'text').map((entry) => entry.text).join(''),
        });
      }
      emitCompletion(dependencies.logger, formatToolCompletion(context, {
        operationId, name: call.name, status, durationMs,
      }));
    }
  };
  server.setRequestHandler('tools/call', (request, requestContext) => {
    const task = callTool(request, requestContext);
    return lifetime?.track(task) ?? task;
  });
  return server;
}

function safeFailure(error: unknown, signal: AbortSignal, search: boolean): { status: CompletionStatus; message: string } {
  if (search) return safeSearchFailure(error, signal);
  let failure: { status: CompletionStatus; message: string } = { status: 'processing_failed', message: 'Page processing failed' };
  try {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      failure = { status: 'cancelled', message: 'Request cancelled' };
    } else if (error instanceof PageFetchFailure) {
      failure = { status: 'fetch_failed', message: error.publicMessage };
    } else {
      const failures = {
        'Server busy. Try again later.': 'busy',
        'Invalid tool arguments': 'invalid_arguments',
        'Access denied': 'access_denied',
        'Page fetch failed': 'fetch_failed',
        'Page processing failed': 'processing_failed',
      } as const;
      const message = error instanceof Error ? error.message : undefined;
      if (typeof message === 'string' && Object.hasOwn(failures, message)) {
        failure = { status: failures[message as keyof typeof failures], message };
      }
    }
  } catch {
    // An untrusted error can throw when its fields are read.
  }
  return signal.aborted ? { status: 'cancelled', message: 'Request cancelled' } : failure;
}

function safeSearchFailure(error: unknown, signal: AbortSignal): { status: CompletionStatus; message: string } {
  let failure: { status: CompletionStatus; message: string } = { status: 'processing_failed', message: 'Search processing failed' };
  try {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      failure = { status: 'cancelled', message: 'Request cancelled' };
    } else if (error instanceof SearchFailure) {
      failure = { status: 'search_failed', message: error.publicMessage };
    } else {
      const failures = {
        'Server busy. Try again later.': 'busy',
        'Invalid tool arguments': 'invalid_arguments',
        'Access denied': 'access_denied',
        'Search failed': 'search_failed',
        'Search processing failed': 'processing_failed',
      } as const;
      const message = error instanceof Error ? error.message : undefined;
      if (typeof message === 'string' && Object.hasOwn(failures, message)) {
        failure = { status: failures[message as keyof typeof failures], message };
      }
    }
  } catch {
    // An untrusted error can throw when its fields are read.
  }
  return signal.aborted ? { status: 'cancelled', message: 'Request cancelled' } : failure;
}

function emitCompletion(logger: SystemLog, record: string): void {
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

function captureCompletion(audit: Pick<AuditLog, 'toolCompleted'> | undefined, completion: ToolCompletion): void {
  try {
    audit?.toolCompleted(completion);
  } catch {
    // Customer capture cannot change a completed tool result.
  }
}
