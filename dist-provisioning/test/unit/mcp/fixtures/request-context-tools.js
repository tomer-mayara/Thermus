import { fromJsonSchema } from '@modelcontextprotocol/server';
export class RequestContextTools {
    static reportTool = 'report_context';
    contexts = [];
    beforeReport;
    constructor(beforeReport) {
        this.beforeReport = beforeReport;
    }
    register = (server, context) => {
        this.contexts.push(context);
        server.registerTool(RequestContextTools.reportTool, {
            description: 'Test only: report the trusted context of this request.',
            inputSchema: fromJsonSchema({ type: 'object', additionalProperties: { type: 'string' } }),
        }, async (args, toolContext) => {
            await this.beforeReport?.(context);
            const report = { context, claims: toolContext.http?.authInfo?.extra, arguments: args };
            return { content: [{ type: 'text', text: JSON.stringify(report) }] };
        });
    };
}
//# sourceMappingURL=request-context-tools.js.map