import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertAllowed, assertForbidden, eslint } from './fixtures/import-guards.ts';

const containerScripts = ['container-edge', 'container-page', 'container-probe'].map(
  (name) => `test/support/container/${name}.ts`,
);

describe('Given rule D1: support code imports only src, packages, and support code', () => {
  for (const filePath of ['test/support/x.ts', 'test/support/dsl/x.ts']) {
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

describe('Given rule D4: a protocol driver imports no DSL module', () => {
  for (const filePath of ['test/support/drivers/browser/x.ts', 'test/support/drivers/mcp/x.ts']) {
    it(`when ${filePath} names the DSL folder, then every literal import and re-export is refused`, async () => {
      await assertForbidden(filePath, [
        '../../dsl/local-commands.ts',
        '../dsl/x.ts',
        '../../../support/dsl/x.ts',
        '../../../../test/support/dsl/x.ts',
      ]);
    });

    it(`when ${filePath} names a test type folder, then rule D1 still refuses the import`, async () => {
      await assertForbidden(filePath, ['../../../unit/mcp/fixtures/a.ts', '../../../../test/acceptance/auth/x.ts']);
    });

    it(`when ${filePath} names src, a package, or other support code, then the import is allowed`, async () => {
      await assertAllowed(filePath, [
        '../../in-process/x.ts',
        '../mcp/x.ts',
        './cookie-jar.ts',
        '../../doubles/auth/x.ts',
        '../../hosted-live/settings.ts',
        '../../../../src/x.ts',
        'node:http',
        '@modelcontextprotocol/client',
        '../../dsl-notes/x.ts',
        './dsl/x.ts',
      ]);
    });
  }
});

describe('Given rule D5: support doubles and fixtures import no DSL module and no protocol driver', () => {
  for (const [filePath, up] of [['test/support/doubles/auth/x.ts', '../../'], ['test/support/fixtures/x.ts', '../']]) {
    it(`when ${filePath} names the DSL or drivers folder, then every literal import and re-export is refused`, async () => {
      await assertForbidden(filePath, [
        `${up}dsl/x.ts`,
        `${up}drivers/browser/hosted-browser.ts`,
        `${up}drivers/mcp/x.ts`,
        `${up}../support/dsl/x.ts`,
        `${up}../../test/support/drivers/mcp/x.ts`,
      ]);
    });

    it(`when ${filePath} names a test type folder, then rule D1 still refuses the import`, async () => {
      await assertForbidden(filePath, [`${up}../unit/mcp/fixtures/a.ts`, `${up}../../test/integration/auth/x.ts`]);
    });

    it(`when ${filePath} names src, a package, or other support code, then the import is allowed`, async () => {
      await assertAllowed(filePath, [
        `${up}in-process/x.ts`,
        `${up}processes/module-paths.ts`,
        '../organizations/x.ts',
        './jwt-signing-key.ts',
        `${up}../../src/x.ts`,
        'node:http',
        'jose',
        `${up}dsl-notes/x.ts`,
        `${up}drivers-notes/x.ts`,
        './drivers/x.ts',
      ]);
    });
  }
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

describe('Given rule D7: no test file lives under test/support/', () => {
  const source = 'export const x = 1;';

  for (const filePath of ['test/support/x.test.ts', 'test/support/drivers/mcp/x.test.ts', 'test/support/doubles/auth/x.test.ts']) {
    it(`when a test file lives at ${filePath}, then the whole file is refused`, async () => {
      const [result] = await eslint.lintText(source, { filePath });
      assert.ok(
        result.messages.some(
          (message) => message.ruleId === 'no-restricted-syntax' && message.severity === 2 && message.message.includes('Rule D7'),
        ),
        `${filePath} must fail rule D7; got ${JSON.stringify(result.messages)}`,
      );
    });
  }

  it('when a test of support code lives in test/unit/test-support/, then the file is allowed', async () => {
    const [result] = await eslint.lintText(source, { filePath: 'test/unit/test-support/x.test.ts' });
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
  });
});

describe('Given the literal guards of the test layer boundaries', () => {
  it('when a dynamic import is computed, then it is outside the literal guard scope', async () => {
    for (const filePath of ['test/support/container/container-page.ts', 'test/unit/mcp/x.test.ts', 'test/acceptance/auth/x.test.ts']) {
      const [result] = await eslint.lintText('export const load = (path: string) => import(path);', { filePath });
      assert.equal(result.errorCount, 0, filePath);
    }
  });
});
