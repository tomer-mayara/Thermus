import { fromJsonSchema, McpServer } from '@modelcontextprotocol/server';
import { requirePermission, type RequestContext } from '../../../../src/accounts/identity/access-context.ts';

type ProbeArguments = Readonly<Record<string, string>> & { readonly url: string };

interface ProbeWork {
  readonly step: 'fetch' | 'clean';
  readonly subject: string;
  readonly tenantId: string;
  readonly url: string;
}

export interface ProbeReport {
  readonly context: RequestContext;
  readonly claims: unknown;
  readonly arguments: ProbeArguments;
}

export class ProtectedToolSpy {
  static readonly toolName = 'protected_fetch_probe';
  static readonly requiredPermission = 'product:access';
  readonly contexts: RequestContext[] = [];
  readonly work: ProbeWork[] = [];
  private readonly beforeWork?: (context: RequestContext) => Promise<void>;

  constructor(beforeWork?: (context: RequestContext) => Promise<void>) {
    this.beforeWork = beforeWork;
  }

  readonly buildServer = (context: RequestContext): McpServer => {
    const server = new McpServer({ name: 'thermus', version: '0.0.0' });
    this.contexts.push(context);
    server.registerTool(ProtectedToolSpy.toolName, {
      description: 'Test only: protected work that reports its trusted context.',
      inputSchema: fromJsonSchema<ProbeArguments>({
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
        additionalProperties: { type: 'string' },
      }),
    }, async (args, toolContext) => {
      requirePermission(context, ProtectedToolSpy.requiredPermission);
      await this.beforeWork?.(context);
      for (const step of ['fetch', 'clean'] as const) {
        this.work.push({ step, subject: context.user.subject, tenantId: context.tenantId, url: args.url });
      }
      const report: ProbeReport = { context, claims: toolContext.http?.authInfo?.extra, arguments: args };
      return { content: [{ type: 'text', text: JSON.stringify(report) }] };
    });
    return server;
  };
}
