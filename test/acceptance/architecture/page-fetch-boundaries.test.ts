import { describe, it } from 'node:test';
import { assertAllowed, assertForbidden } from './fixtures/import-guards.ts';

describe('Given the protected page-fetch boundary', () => {
  for (const filePath of ['src/page-fetch/fetch-page.ts', 'src/page-fetch/execute-outgoing-step.ts', 'src/page-fetch/execute-incoming-step.ts', 'src/page-fetch/pipeline-step.ts', 'src/page-fetch/step-record.ts', 'src/page-fetch/nested/operation.ts']) {
    const root = filePath.includes('/nested/') ? '../../' : '../';

    it(`when ${filePath} names transport or composition, then every literal import and re-export is refused`, async () => {
      await assertForbidden(filePath, [
        `${root}mcp/get-url-as-markdown.ts`,
        `${root}mcp/fetch-tool-schema.ts`,
        `${root}mcp/mcp-server.js`,
        `${root}http/server.ts`,
        `${root}hosted-admin/account-routes.ts`,
        `${root}application.ts`,
        `${root}fetch-tool.ts`,
        `${root}hosted-workos-application.js`,
        `${root}hosted-renderer-startup.ts`,
        `${root}hosted-portal.ts`,
        `${root}index.ts`,
        '@modelcontextprotocol/server',
        '@modelcontextprotocol/client',
      ]);
    });

    it(`when ${filePath} names an implementation, then type imports cannot hide that dependency`, async () => {
      await assertForbidden(filePath, [
        `${root}auth/local-auth/better-auth/better-auth-provider.ts`,
        `${root}auth/hosted-auth/workos/workos-auth-provider.js`,
        `${root}website-fetcher/website-fetcher-lightpanda.ts`,
        `${root}website-fetcher/network-policy.ts`,
        `${root}html-cleaner-pipeline/html-to-markdown-pipeline.ts`,
        `${root}html-cleaner-pipeline/html-input-limit.ts`,
        `${root}logging/console-logger.ts`,
        `${root}logging/otel-logger.ts`,
        'better-auth',
        '@better-auth/mcp',
        '@workos-inc/node',
        'adblock-rs',
        'agent-input-sanitizer/html',
        'defuddle/node',
        '@opentelemetry/sdk-logs',
        '@opentelemetry/exporter-logs-otlp-http',
      ]);
    });

    it(`when ${filePath} names public contracts or its own modules, then collaboration is allowed`, async () => {
      await assertAllowed(filePath, [
        `${root}auth/access-context.ts`,
        `${root}auth/identity-verifier.ts`,
        `${root}website-fetcher/website-fetcher.ts`,
        `${root}website-fetcher/website-fetcher.js`,
        './fetch-url.ts',
        './pipeline-step.ts',
        './observe-request-step.ts',
        './step-record.ts',
        './execute-outgoing-step.ts',
        './execute-incoming-step.ts',
        '@example/defuddle',
        'agent-input-sanitizer-notes',
        '@opentelemetry/sdk-logs-notes',
      ]);
    });
  }

  it('when the cleaner adapter implements the neutral role, then the inward type dependency is allowed', async () => {
    await assertAllowed('src/html-cleaner-pipeline/process-html-step.ts', ['../page-fetch/pipeline-step.ts']);
  });

  it('when composition selects real collaborators, then it can name the core and both adapters', async () => {
    await assertAllowed('src/fetch-tool.ts', [
      './page-fetch/fetch-page.ts',
      './html-cleaner-pipeline/process-html-step.ts',
      './website-fetcher/website-fetcher-lightpanda.ts',
      './mcp/get-url-as-markdown.ts',
    ]);
  });
});
