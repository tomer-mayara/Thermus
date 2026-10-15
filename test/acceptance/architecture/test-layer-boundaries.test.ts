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

const testTypes = ['unit', 'integration', 'interface', 'acceptance'];
const sameTypeImports = [
  '../../support/x.ts',
  './fixtures/y.ts',
  '../area/y.ts',
  '../../../src/x.ts',
  'node:test',
  '@modelcontextprotocol/server',
];
const workSliceEntry = '../../acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch';
const containerScripts = ['container-edge', 'container-page', 'container-probe'].flatMap((name) => [
  `test/support/${name}.ts`,
  `test/support/container/${name}.ts`,
]);

describe('Given rule D1: support code imports only src, packages, and support code', () => {
  for (const filePath of ['test/support/x.ts', 'test/support/doubles/auth/x.ts']) {
    it(`when ${filePath} names a test type folder, then every literal import and re-export is refused`, async () => {
      await assertForbidden(filePath, [
        '../unit/mcp/fixtures/a.ts',
        '../../../integration/auth/fixtures/b.ts',
        '../interface/x.ts',
        '../acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts',
        '../../test/unit/a.ts',
      ]);
    });

    it(`when ${filePath} names src, a package, or support code, then the import is allowed`, async () => {
      await assertAllowed(filePath, [
        '../../src/application.ts',
        './cookie-jar.ts',
        '../drivers/mcp/mcp-http-request.ts',
        '../../hosted-live/settings.ts',
        'node:test',
        '@modelcontextprotocol/server',
        '../unit-notes/x.ts',
        './unit/x.ts',
      ]);
    });
  }
});

describe('Given rule D2: a file in test/<type>/ imports no other test type', () => {
  for (const type of testTypes) {
    const filePath = `test/${type}/${type === 'unit' ? 'mcp' : 'auth'}/x.test.ts`;
    const others = testTypes.filter((other) => other !== type);

    it(`when ${filePath} names another test type, then every literal import and re-export is refused`, async () => {
      await assertForbidden(
        filePath,
        others.flatMap((other) => [`../../${other}/area/y.ts`, `../../${other}/area/fixtures/y.ts`, `../../test/${other}/y.ts`]),
      );
    });

    it(`when ${filePath} names support code, its own fixtures, its own type, src, or a package, then the import is allowed`, async () => {
      await assertAllowed(filePath, sameTypeImports);
    });
  }

  it('when names only resemble a test type folder, then the exact path segments do not refuse them', async () => {
    const resemblingPaths = testTypes.flatMap((other) => [`../${other}-notes/x.ts`, `./${other}/x.ts`]);
    for (const type of testTypes) {
      await assertAllowed(`test/${type}/area/x.test.ts`, [...resemblingPaths, '../support-unit/x.ts']);
    }
  });
});

describe('Given the one D2 exception: the work-slice unit test imports the work-slice entry point', () => {
  const filePath = 'test/unit/work-slice/basic-mcp-url-fetch.test.ts';

  it('when the test names the entry point, then the import is allowed', async () => {
    await assertAllowed(filePath, [`${workSliceEntry}.ts`, `${workSliceEntry}.js`, ...sameTypeImports]);
  });

  it('when the test names another file of another test type, then the import is refused', async () => {
    await assertForbidden(filePath, [
      '../../acceptance/work-slice/basic-mcp-url-fetch.ts',
      '../../acceptance/work-slice/basic-mcp-url-fetch/other.ts',
      '../../acceptance/work-slice/other.ts',
      '../../acceptance/auth/x.ts',
      '../../integration/auth/x.ts',
      '../../interface/x.ts',
    ]);
  });

  it('when the test names the fixtures of another unit package, then rule D3 still refuses them', async () => {
    await assertForbidden(filePath, ['../hosted-admin/fixtures/a.ts']);
  });
});

describe('Given rule D3: a unit test imports fixtures only from its own package', () => {
  for (const [filePath, up] of [['test/unit/mcp/x.test.ts', '../'], ['test/unit/mcp/fixtures/a.ts', '../../']]) {
    it(`when ${filePath} names the fixtures of another unit package, then the import is refused`, async () => {
      await assertForbidden(filePath, [
        `${up}hosted-admin/fixtures/a.ts`,
        `${up}organizations/fixtures/b.ts`,
        `${up}support-unit/fixtures/c.ts`,
        `${up}../test/unit/organizations/fixtures/b.ts`,
      ]);
    });

    it(`when ${filePath} names its own fixtures or shared support, then the import is allowed`, async () => {
      await assertAllowed(filePath, ['./fixtures/a.ts', './b.ts', `${up}../support/fixtures/x.ts`, `${up}../support/doubles/auth/a.ts`]);
    });
  }

  it('when a nested folder of a package names fixtures, then only the fixtures of its own package are allowed', async () => {
    const filePath = 'test/unit/html-cleaner-pipeline/ad-cleaner/x.test.ts';
    await assertAllowed(filePath, ['../fixtures/ad-pages.ts']);
    await assertForbidden(filePath, ['../../mcp/fixtures/a.ts']);
  });
});

describe('Given rule D6: a container script imports only node: modules', () => {
  for (const filePath of containerScripts) {
    it(`when ${filePath} names a module that is not a node: module, then the import is refused`, async () => {
      await assertForbidden(filePath, [
        '../../src/application.ts',
        './docker-cli.ts',
        '../cookie-jar.ts',
        'adblock-rs',
        '@modelcontextprotocol/server',
      ]);
    });
  }

  it('when a container script names node: modules, then the imports are allowed', async () => {
    for (const filePath of containerScripts) {
      await assertAllowed(filePath, ['node:http', 'node:dns/promises', 'node:child_process', 'node:fs']);
    }
  });
});

describe('Given the literal guards of the test layer boundaries', () => {
  it('when a dynamic import is computed, then it is outside the literal guard scope', async () => {
    for (const filePath of ['test/support/container-page.ts', 'test/unit/mcp/x.test.ts', 'test/acceptance/auth/x.test.ts']) {
      const [result] = await eslint.lintText('export const load = (path: string) => import(path);', { filePath });
      assert.equal(result.errorCount, 0, filePath);
    }
  });
});
