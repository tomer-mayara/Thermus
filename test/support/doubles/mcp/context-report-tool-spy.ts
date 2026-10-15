import { fromJsonSchema, McpServer } from '@modelcontextprotocol/server';
import type { RequestContext } from '../../../../src/auth/access-context.ts';

export type ContextReportArguments = Readonly<Record<string, string>>;

export interface ContextReport {
  readonly context: RequestContext;
  readonly claims: unknown;
  readonly arguments: ContextReportArguments;
}

export class RequestContextTools {
  static readonly reportTool = 'report_context';
  readonly contexts: RequestContext[] = [];
  private readonly beforeReport?: (context: RequestContext) => Promise<void>;

  constructor(beforeReport?: (context: RequestContext) => Promise<void>) {
    this.beforeReport = beforeReport;
  }

  readonly buildServer = (context: RequestContext): McpServer => {
    const server = new McpServer({ name: 'thermus', version: '0.0.0' });
    this.contexts.push(context);
    server.registerTool(RequestContextTools.reportTool, {
      description: 'Test only: report the trusted context of this request.',
      inputSchema: fromJsonSchema<ContextReportArguments>({ type: 'object', additionalProperties: { type: 'string' } }),
    }, async (args, toolContext) => {
      await this.beforeReport?.(context);
      const report: ContextReport = { context, claims: toolContext.http?.authInfo?.extra, arguments: args };
      return { content: [{ type: 'text', text: JSON.stringify(report) }] };
    });
    return server;
  };
}
