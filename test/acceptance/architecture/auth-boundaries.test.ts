import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint({ overrideConfigFile: resolve('.habit-hooks/eslint.config.mjs') });

const forbiddenForms = [
  ['static import', (path: string) => `import { feature } from '${path}'; export { feature };`],
  ['type import', (path: string) => `import type { Feature } from '${path}'; export type { Feature };`],
  ['inline type import', (path: string) => `import { type Feature } from '${path}'; export type { Feature };`],
  ['named re-export', (path: string) => `export { feature } from '${path}';`],
  ['type re-export', (path: string) => `export type { Feature } from '${path}';`],
  ['star re-export', (path: string) => `export * from '${path}';`],
  ['namespace re-export', (path: string) => `export * as features from '${path}';`],
  ['literal dynamic import', (path: string) => `export const load = () => import('${path}');`],
] as const;

async function assertForbidden(filePath: string, paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    for (const [name, source] of forbiddenForms) {
      const [result] = await eslint.lintText(source(path), { filePath });
      const rule = name === 'literal dynamic import' ? 'no-restricted-syntax' : 'no-restricted-imports';
      assert.ok(
        result.messages.some((message) => message.ruleId === rule && message.severity === 2),
        `${filePath}: ${name} of ${path} must fail ${rule}; got ${JSON.stringify(result.messages)}`,
      );
    }
  }
}

async function assertAllowed(filePath: string, paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    for (const [name, source] of forbiddenForms) {
      const [result] = await eslint.lintText(source(path), { filePath });
      assert.equal(result.errorCount, 0, `${filePath}: ${name} of ${path}: ${JSON.stringify(result.messages)}`);
    }
  }
}

describe('Given the configured direct auth import boundaries', () => {
  for (const filePath of ['src/auth/access-context.ts', 'src/auth/identity-verifier.ts']) {
    it(`when ${filePath} names a provider, then every literal import and re-export is refused`, async () => {
      await assertForbidden(filePath, [
        './local-auth/better-auth/better-auth-provider.ts',
        '../auth/local-auth/better-auth/better-auth-runtime.js',
        './hosted-auth/workos/workos-auth-provider.ts',
        '../auth/hosted-auth/workos/workos-browser-session.js',
        'better-auth',
        'better-auth/plugins/admin',
        '@better-auth/mcp',
        '@better-auth/mcp/client',
        '@workos-inc/node',
      ]);
    });

    it(`when ${filePath} names a transport implementation, then the dependency is refused`, async () => {
      await assertForbidden(filePath, [
        '../mcp/identity-verifier-sdk-adapter.ts',
        '../mcp/mcp-server.js',
        '../http/server.ts',
        '../hosted-admin/account-routes.ts',
        '@modelcontextprotocol/server',
        '@modelcontextprotocol/server/auth',
        '@modelcontextprotocol/client',
      ]);
    });
  }

  for (const name of ['local-user-administration', 'local-auth-command', 'local-auth-command-line']) {
    const filePath = `src/auth/local-auth/${name}.ts`;
    it(`when ${filePath} names a provider, then the neutral local role stays independent`, async () => {
      await assertForbidden(filePath, [
        './better-auth/better-auth-user-administration.ts',
        '../local-auth/better-auth/local-installation.js',
        '../../auth/local-auth/better-auth/local-auth-pages.ts',
        '../hosted-auth/workos/workos-auth-provider.ts',
        'better-auth/cookies',
        '@better-auth/mcp',
        '@workos-inc/node',
      ]);
    });
  }

  for (const filePath of ['src/mcp/mcp-server.ts', 'src/mcp/nested/adapter.ts', 'src/hosted-admin/account-routes.ts']) {
    it(`when ${filePath} names an auth implementation, then the consumer is refused`, async () => {
      const root = filePath.includes('/nested/') ? '../../' : '../';
      await assertForbidden(filePath, [
        `${root}auth/local-auth/better-auth/better-auth-provider.ts`,
        `${root}auth/local-auth/local-auth-command.ts`,
        `${root}auth/local-auth/local-auth-command-line.js`,
        `${root}auth/hosted-auth/workos/workos-auth-provider.ts`,
        `${root}auth/hosted-auth/workos/workos-session-routes.js`,
        'better-auth',
        '@better-auth/mcp',
        '@workos-inc/node',
      ]);
    });
  }

  it('when neutral local files name public contracts, then the collaboration is allowed', async () => {
    for (const name of ['local-user-administration', 'local-auth-command', 'local-auth-command-line']) {
      await assertAllowed(`src/auth/local-auth/${name}.ts`, [
        '../../config/deployment-config.ts',
        './local-user-administration.ts',
        './local-auth-command-line.ts',
        '../access-context.ts',
        '../identity-verifier.ts',
      ]);
    }
  });

  it('when external consumers name auth roles, use cases, headers, or their own modules, then imports are allowed', async () => {
    for (const filePath of ['src/mcp/mcp-server.ts', 'src/hosted-admin/account-routes.ts']) {
      await assertAllowed(filePath, [
        '../auth/access-context.ts',
        '../auth/identity-verifier.ts',
        '../auth/local-auth/local-user-administration.ts',
        '../auth/hosted-auth/browser-session.ts',
        '../auth/hosted-auth/browser-session.js',
        '../organizations/organization-administration.ts',
        '../http/client-address.ts',
        './identity-verifier-sdk-adapter.ts',
        './account-pages.ts',
        '@modelcontextprotocol/server',
      ]);
    }
  });

  it('when providers and their browser adapters name their own implementation, then imports are allowed', async () => {
    for (const name of ['better-auth-provider', 'local-auth-pages', 'local-auth-provider-routes']) {
      await assertAllowed(`src/auth/local-auth/better-auth/${name}.ts`, [
        './better-auth-runtime.ts',
        './local-auth-provider-routes.ts',
        './local-auth-page-html.ts',
        '../local-user-administration.ts',
        '../../../http/client-address.ts',
        'better-auth',
        'better-auth/cookies',
        '@better-auth/mcp',
      ]);
    }
    for (const name of ['workos-auth-provider', 'workos-browser-session', 'workos-session-routes', 'workos-organizations']) {
      await assertAllowed(`src/auth/hosted-auth/workos/${name}.ts`, [
        './workos-settings.ts',
        './workos-organizations.ts',
        '../browser-session.ts',
        '../../access-context.ts',
        '../../identity-verifier.ts',
        '../../../organizations/organization-directory.ts',
        '@workos-inc/node',
        'jose',
      ]);
    }
  });

  it('when composition roots select concrete implementations, then static and lazy imports are allowed', async () => {
    for (const filePath of ['src/application.ts', 'src/index.ts', 'src/hosted-workos-application.ts']) {
      await assertAllowed(filePath, [
        './auth/local-auth/better-auth/better-auth-user-administration.ts',
        './auth/hosted-auth/workos/workos-auth-provider.ts',
        'better-auth',
        '@better-auth/mcp',
        '@workos-inc/node',
      ]);
    }
  });

  it('when names only resemble implementation paths, then the exact scopes and path segments do not refuse them', async () => {
    await assertAllowed('src/auth/access-context.ts', [
      './identity-verifier.ts',
      './hosted-auth/browser-session.ts',
      '../http/client-address.ts',
      '../reports/auth/local-auth/better-auth/summary.ts',
      './local-auth/better-auth-notes.ts',
      './hosted-auth/browser-session-notes-not-a-provider.ts',
      'better-auth-notes',
      '@better-auth/mcp-notes',
      '@example/better-auth',
      '@modelcontextprotocol/server-notes',
    ]);
    await assertAllowed('src/auth/local-auth/local-auth-command-notes.ts', ['./better-auth/better-auth-runtime.ts']);
    await assertAllowed('src/auth/nested/feature.ts', ['../local-auth/better-auth/better-auth-runtime.ts']);
  });

  it('when a dynamic import is computed, then it is outside the literal guard scope', async () => {
    const [result] = await eslint.lintText('export const load = (path: string) => import(path);', {
      filePath: 'src/auth/identity-verifier.ts',
    });
    assert.equal(result.errorCount, 0);
  });
});
