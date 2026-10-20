import { describe, it } from 'node:test';
import { assertAllowed, assertForbidden } from './fixtures/import-guards.ts';

describe('Given the protected search-pipeline boundary', () => {
  for (const filePath of ['src/search-pipeline/search-pipeline.ts', 'src/search-pipeline/nested/operation.ts']) {
    const root = filePath.includes('/nested/') ? '../../' : '../';

    it(`when ${filePath} names concrete collaborators, then all literal imports and re-exports are refused`, async () => {
      await assertForbidden(filePath, [
        `${root}search-engine/search-engine-brave-http.ts`,
        `${root}search-engine/brave-search-page.js`,
        `${root}search-engine/nested/classifier.ts`,
        `${root}page-fetch/fetch-page.ts`,
        `${root}page-fetch/fetch-failure.js`,
        `${root}page-fetch/execute-outgoing-step.ts`,
        `${root}page-fetch/execute-incoming-step.js`,
        `${root}page-fetch/observe-request-step.ts`,
        `${root}page-fetch/process-html-step.js`,
        `${root}website-fetcher/website-fetcher-lightpanda.ts`,
        `${root}html-cleaner-pipeline/process-html-step.ts`,
        `${root}logging/console-logger.js`,
        `${root}auth/local-auth/better-auth/better-auth-provider.ts`,
        `${root}auth/hosted-auth/workos/workos-auth-provider.js`,
        `${root}auth/local-auth/local-auth-command.ts`,
        `${root}mcp/search.ts`,
        `${root}http/server.js`,
        `${root}fetch-tool.ts`,
        `${root}application.js`,
        '@modelcontextprotocol/server',
        '@modelcontextprotocol/client',
        '@workos-inc/node',
        'agent-input-sanitizer/html',
      ]);
    });

    it(`when ${filePath} names public contracts and local modules, then collaboration is allowed`, async () => {
      await assertAllowed(filePath, [
        `${root}auth/access-context.ts`,
        `${root}auth/identity-verifier.js`,
        `${root}website-fetcher/website-fetcher.ts`,
        `${root}search-engine/search-engine.js`,
        ...['pipeline-step', 'execution-context', 'step-record', 'renderer-failure-reports'].flatMap((name) =>
          [`${root}page-fetch/${name}.ts`, `${root}page-fetch/${name}.js`]),
        './search-query.ts',
        './search-failure.ts',
        './execute-outgoing-step.ts',
        './execute-incoming-step.ts',
      ]);
    });
  }
});
