import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eslint } from './fixtures/import-guards.ts';

const rule = 'phase-one/import-context';
const authFile = 'src/interfaces/web/auth/workos/workos-session-routes.ts';
const accountFile = 'src/interfaces/web/account/account-routes.ts';
const provider = '../../../../accounts/providers/workos/';

async function refused(filePath: string, source: string): Promise<void> {
  const [answer] = await eslint.lintText(source, { filePath });
  assert.ok(answer.messages.some((message) => message.ruleId === rule && message.severity === 2), `${filePath}: ${source}: ${JSON.stringify(answer.messages)}`);
}

async function allowed(filePath: string, source: string): Promise<void> {
  const [answer] = await eslint.lintText(source, { filePath });
  assert.equal(answer.errorCount, 0, `${filePath}: ${source}: ${JSON.stringify(answer.messages)}`);
}

describe('Given the merged server-web owner with a narrow WorkOS browser role', () => {
  it('when its WorkOS adapter imports named whole-statement role types and approved helpers, then access is allowed', async () => {
    await allowed(authFile, `import type { WorkOSBrowserSession, WorkOSSignedInSession } from '${provider}workos-browser-session.ts'; export type Role = WorkOSBrowserSession | WorkOSSignedInSession;`);
    await allowed(authFile, `import { sameSecret } from '${provider}session-cookies.ts'; export { sameSecret };`);
    await allowed(authFile, `import { validateSignupDocuments } from '${provider}workos-signup-documents.ts'; export { validateSignupDocuments };`);
    await allowed('src/interfaces/web/auth/workos/workos-signup-routes.ts', "import { readForm } from '../../account/account-form.ts'; export { readForm };");
  });

  for (const source of [
    `import { WorkOSBrowserSession } from '${provider}workos-browser-session.ts'; export { WorkOSBrowserSession };`,
    `import { type WorkOSBrowserSession } from '${provider}workos-browser-session.ts'; export type { WorkOSBrowserSession };`,
    `import type WorkOSBrowserSession from '${provider}workos-browser-session.ts'; export type Role = WorkOSBrowserSession;`,
    `import * as cookies from '${provider}session-cookies.ts'; export { cookies };`,
    `export * from '${provider}session-cookies.ts';`,
    `export * as cookies from '${provider}session-cookies.ts';`,
    `void import('${provider}session-cookies.ts');`,
    `void import(\`${provider}session-cookies.ts\`);`,
    `export type Role = import('${provider}workos-auth-provider.ts').WorkOSAuthProvider;`,
    `import { sessionCookie } from '${provider}session-cookies.ts'; export { sessionCookie };`,
    "import { WorkOS } from '@workos-inc/node'; export { WorkOS };",
  ]) {
    it(`when a browser adapter broadens provider access with ${source}, then access is refused`, async () => {
      await refused(authFile, source);
    });
  }

  it('when account code imports even an approved provider helper or role, then access is refused', async () => {
    await refused(accountFile, "import { sameSecret } from '../../../accounts/providers/workos/session-cookies.ts'; export { sameSecret };");
    await refused(accountFile, "import type { WorkOSBrowserSession } from '../../../accounts/providers/workos/workos-browser-session.ts'; export type Role = WorkOSBrowserSession;");
  });

  it('when composition selects provider implementations, then construction remains allowed', async () => {
    await allowed('src/app/hosted-workos-application.ts', "import { WorkOSAuthProvider } from '../accounts/providers/workos/workos-auth-provider.ts'; export { WorkOSAuthProvider };");
  });
});

describe('Given portal browser code and Node Vite tooling in one owner', () => {
  for (const source of [
    "import { readFile } from 'node:fs'; export { readFile };",
    "import { readFile } from 'fs/promises'; export { readFile };",
    "import { defineConfig } from 'vite'; export { defineConfig };",
    "import config from './vite.config.ts'; export { config };",
    "import { createApplication } from '../../app/application.ts'; export { createApplication };",
    "import { WorkOS } from '@workos-inc/node'; export { WorkOS };",
    "void import('node:fs');",
    "export type Role = import('../../accounts/identity/access-context.ts').RequestContext;",
  ]) {
    it(`when browser runtime names ${source}, then the dependency is refused`, async () => {
      await refused('src/interfaces/user-portal/main.ts', source);
    });
  }

  it('when Vite tooling imports declared Node and build dependencies, then it stays allowed', async () => {
    await allowed('src/interfaces/user-portal/vite.config.ts', "import { fileURLToPath } from 'node:url'; import { defineConfig } from 'vite'; export { fileURLToPath, defineConfig };");
    await allowed('src/interfaces/user-portal/main.ts', "import { initializePortal } from './portal.ts'; export { initializePortal };");
    await allowed('src/interfaces/user-portal/env.d.ts', '/// <reference types="vite/client" />\nexport {};');
  });
});

describe('Given moved source owners and their existing direct-import protections', () => {
  for (const [filePath, target] of [
    ['src/accounts/identity/access-context.ts', '../providers/workos/workos-auth-provider.ts'],
    ['src/interfaces/cli/local-auth-command.ts', '../../accounts/providers/better-auth/better-auth-runtime.ts'],
    ['src/interfaces/mcp/mcp-server.ts', '../../accounts/providers/workos/workos-auth-provider.ts'],
    ['src/pipelines/page-fetch/fetch-page.ts', '../../interfaces/mcp/mcp-server.ts'],
    ['src/pipelines/search/search-pipeline.ts', '../page-fetch/fetch-page.ts'],
    ['src/pipelines/page-fetch/fetch-page.ts', '../providers/website-fetcher/network-policy.ts'],
    ['src/pipelines/search/search-pipeline.ts', '../providers/search-engine/search-engine-brave-http.ts'],
    ['src/pipelines/html-processing/html-to-markdown-pipeline.ts', '../../interfaces/mcp/mcp-server.ts'],
    ['src/pipelines/providers/website-fetcher/website-fetcher.ts', '../../../accounts/identity/access-context.ts'],
  ] as const) {
    for (const source of [
      `import { feature } from '${target}'; export { feature };`,
      `import type { Feature } from '${target}'; export type { Feature };`,
      `export * from '${target}';`,
      `void import('${target}');`,
      `export type Feature = import('${target}').Feature;`,
    ]) {
      it(`when ${filePath} names ${source}, then the import is refused`, async () => {
        await refused(filePath, source);
      });
    }
  }

  it('when pipelines use their public contracts and composition selects concrete collaborators, then access remains allowed', async () => {
    await allowed('src/pipelines/page-fetch/fetch-page.ts', "import { writeStepRecord } from '../execution/step-record.ts'; export { writeStepRecord };");
    await allowed('src/pipelines/search/search-pipeline.ts', "import type { SearchEngine } from '../providers/search-engine/search-engine.ts'; export type { SearchEngine };");
    await allowed('src/pipelines/page-fetch/fetch-page.ts', "import type { WebsiteFetcher } from '../providers/website-fetcher/website-fetcher.ts'; export type { WebsiteFetcher };");
    await allowed('src/app/fetch-tool.ts', "import { WebsiteFetcherLightpanda } from '../pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts'; export { WebsiteFetcherLightpanda };");
  });
});


describe('Given exact public module and compiler-context paths', () => {
  it('when the root Vite config names a server provider, then the shared component policy still refuses it', async () => {
    await refused('src/interfaces/user-portal/vite.config.ts', "import { WorkOSAuthProvider } from '../../accounts/providers/workos/workos-auth-provider.ts'; export { WorkOSAuthProvider };");
  });

  it('when a component computes an import target, then the uninspectable dependency is refused', async () => {
    await refused('src/accounts/identity/identity-verifier.ts', "const target = '../providers/workos/workos-auth-provider.ts'; void import(target);");
  });

  it('when a private WorkOS subfolder repeats a public basename, then the helper and role stay private', async () => {
    await refused(authFile, `import { sameSecret } from '${provider}private/session-cookies.ts'; export { sameSecret };`);
    await refused(authFile, `import type { WorkOSBrowserSession } from '${provider}private/workos-browser-session.ts'; export type Role = WorkOSBrowserSession;`);
  });

  it('when browser code repeats the Vite config basename in a nested folder, then Node dependencies stay refused', async () => {
    await refused('src/interfaces/user-portal/private/vite.config.ts', "import { fileURLToPath } from 'node:url'; export { fileURLToPath };");
  });
});
