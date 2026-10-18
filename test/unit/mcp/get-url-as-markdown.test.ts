import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import { createGetURLAsMarkdown } from '../../../src/mcp/get-url-as-markdown.ts';
import type { ExecutionContext } from '../../../src/page-fetch/execution-context.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

const context: RequestContext = { user: { authority: 'authority', subject: 'subject' }, tenantId: 'tenant', grants: [], permissions: ['product:access'] };

for (const markdown of ['', '\n# Exact Markdown\n']) {
  test(`Given a released result ${JSON.stringify(markdown)}, when the MCP adapter runs, then it forwards the same execution context and returns exact text`, async (t) => {
    const execution = { ...executionContextOf(), operationId: 'D35803FB-2C25-4273-8967-99EED265721B' };
    const fetchPage = t.mock.fn(async (_url: string, _context: RequestContext, _execution: ExecutionContext) => ({ status: 'released' as const, markdown }));
    const operation = createGetURLAsMarkdown(fetchPage);

    assert.equal(await operation('HTTPS://Example.COM/Page', context, execution), markdown);
    assert.equal(fetchPage.mock.callCount(), 1);
    assert.deepEqual(fetchPage.mock.calls[0].arguments, ['HTTPS://Example.COM/Page', context, execution]);
    assert.equal(fetchPage.mock.calls[0].arguments[2], execution);
  });
}
