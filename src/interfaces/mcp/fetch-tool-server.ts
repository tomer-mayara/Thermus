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

export interface ToolServerDependencies {
  operations: ToolOperations;
  logger: SystemLog;
  audit?: Pick<AuditLog, 'toolCompleted'>;
}

interface ToolServer {
  readonly server: Server;
  readonly context: RequestContext;
  readonly dependencies: ToolServerDependencies;
}

type ValidatedCall = { tool: 'search'; input: { query: string; reason: string } } | { tool: 'getURLAsMarkdown'; input: { url: string; reason: string } };

export function createFetchToolServer(context: RequestContext, dependencies: ToolServerDependencies, lifetime?: McpRequestLifetime): Server {
  const server = new Server({ name: 'thermus', version: '0.0.0' }, { capabilities: { tools: {} } });
  const tools: ToolServer = { server, context, dependencies };
  server.setRequestHandler('tools/list', () => ({ tools: toolDescriptors() }));
  server.setRequestHandler('tools/call', (request, requestContext) => {
    const task = new ToolCall(tools, request.params, callSignal(requestContext, lifetime)).run();
    return lifetime?.track(task) ?? task;
  });
  return server;
}

function toolDescriptors() {
  return [{
    name: 'getURLAsMarkdown',
    description: 'Fetch a known web page URL as Markdown. For web searches, use search instead of fetching a search engine results URL. Give the reason the agent needs the page.',
    inputSchema: fetchToolInputSchema,
  }, {
    name: 'search',
    description: 'Search the web with a text query and return cleaned results as Markdown. Use this tool for web searches; search engines may block generic page-fetch requests. Use getURLAsMarkdown to read a result page. Give the reason the agent needs the search.',
    inputSchema: searchToolInputSchema,
  }];
}

function callSignal(requestContext: ServerContext, lifetime: McpRequestLifetime | undefined): AbortSignal {
  const signal = requestContext.mcpReq.signal;
  return lifetime === undefined ? signal : AbortSignal.any([signal, lifetime.signal]);
}

class ToolCall {
  private readonly operationId = randomUUID();
  private readonly startedAt = performance.now();
  private status: CompletionStatus = 'processing_failed';
  private validated: ValidatedCall | undefined;
  private projected: CallToolResult | undefined;

  constructor(private readonly tools: ToolServer, private readonly call: CallToolRequest['params'], private readonly signal: AbortSignal) {}

  async run(): Promise<CallToolResult> {
    try {
      return this.project(await this.result());
    } catch (error) {
      if (this.status === 'unknown_tool') throw error;
      const failure = this.failure(error);
      this.status = failure.status;
      return this.project({ content: [{ type: 'text', text: failure.message }], isError: true });
    } finally {
      this.complete();
    }
  }

  private result(): Promise<CallToolResult> {
    if (this.call.name === 'search') return this.search();
    if (this.call.name === 'getURLAsMarkdown') return this.fetch();
    this.status = 'unknown_tool';
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Unknown tool');
  }

  private async search(): Promise<CallToolResult> {
    const args = await parseSearchToolArguments(this.call.arguments);
    if (args === undefined) throw new Error('Invalid tool arguments');
    this.validated = { tool: 'search', input: { query: args.query, reason: args.reason } };
    this.signal.throwIfAborted();
    const outcome = await this.tools.dependencies.operations.search(args.query, this.tools.context, { signal: this.signal, operationId: this.operationId });
    this.signal.throwIfAborted();
    const result = projectSearchOutcome(outcome);
    this.status = result.isError ? 'withheld' : 'success';
    return result;
  }

  private async fetch(): Promise<CallToolResult> {
    const args = await parseFetchToolArguments(this.call.arguments);
    if (args === undefined) throw new Error('Invalid tool arguments');
    this.validated = { tool: 'getURLAsMarkdown', input: { url: args.url, reason: args.reason } };
    this.signal.throwIfAborted();
    const markdown = await this.tools.dependencies.operations.fetch(args.url, this.tools.context, { signal: this.signal, operationId: this.operationId });
    this.signal.throwIfAborted();
    if (typeof markdown !== 'string') throw new Error('Page processing failed');
    this.status = 'success';
    return { content: [{ type: 'text', text: markdown }] };
  }

  private failure(error: unknown): { status: CompletionStatus; message: string } {
    return this.call.name === 'search' ? safeSearchFailure(error, this.signal) : safeFetchFailure(error, this.signal);
  }

  private project(result: CallToolResult): CallToolResult {
    return this.projected = this.tools.server.projectCallToolResult(result, undefined);
  }

  private complete(): void {
    const durationMs = Math.max(0, performance.now() - this.startedAt);
    this.captureCustomerCompletion(durationMs);
    emitCompletion(this.tools.dependencies.logger, formatToolCompletion(this.tools.context, {
      operationId: this.operationId, name: this.call.name, status: this.status, durationMs,
    }));
  }

  private captureCustomerCompletion(durationMs: number): void {
    const { audit } = this.tools.dependencies;
    const { validated, projected, status } = this;
    if (audit === undefined || validated === undefined || projected === undefined || !isCapturedStatus(status)) return;
    captureCompletion(audit, {
      ...validated, timestamp: new Date().toISOString(), organizationId: this.tools.context.tenantId,
      actor: actorOf(this.tools.context),
      operationId: this.operationId, status, durationMs,
      result: projected.content.filter((entry) => entry.type === 'text').map((entry) => entry.text).join(''),
    });
  }
}

function isCapturedStatus(status: CompletionStatus): status is ToolCompletion['status'] {
  return status !== 'invalid_arguments' && status !== 'unknown_tool';
}

function actorOf({ user }: RequestContext): ToolCompletion['actor'] {
  return { authority: user.authority, subject: user.subject, ...(user.name === undefined ? {} : { name: user.name }) };
}

function safeFetchFailure(error: unknown, signal: AbortSignal): { status: CompletionStatus; message: string } {
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
