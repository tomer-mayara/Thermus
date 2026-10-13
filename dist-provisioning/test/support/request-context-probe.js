import { fromJsonSchema } from '@modelcontextprotocol/server';
import { requirePermission } from '../../src/auth/access-context.js';
export class RequestContextProbe {
    static toolName = 'protected_fetch_probe';
    static requiredPermission = 'product:access';
    contexts = [];
    work = [];
    beforeWork;
    constructor(beforeWork) {
        this.beforeWork = beforeWork;
    }
    register = (server, context) => {
        this.contexts.push(context);
        server.registerTool(RequestContextProbe.toolName, {
            description: 'Test only: protected work that reports its trusted context.',
            inputSchema: fromJsonSchema({
                type: 'object',
                properties: { url: { type: 'string' } },
                required: ['url'],
                additionalProperties: { type: 'string' },
            }),
        }, async (args, toolContext) => {
            requirePermission(context, RequestContextProbe.requiredPermission);
            await this.beforeWork?.(context);
            for (const step of ['fetch', 'clean']) {
                this.work.push({ step, subject: context.user.subject, tenantId: context.tenantId, url: args.url });
            }
            const report = { context, claims: toolContext.http?.authInfo?.extra, arguments: args };
            return { content: [{ type: 'text', text: JSON.stringify(report) }] };
        });
    };
}
//# sourceMappingURL=request-context-probe.js.map