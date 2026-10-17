import { describe, it } from 'node:test';
import { assertAllowed, assertForbidden } from './fixtures/import-guards.ts';

const testTypes = ['unit', 'integration', 'interface', 'acceptance'];
const sameTypeImports = [
  '../../support/x.ts',
  './fixtures/y.ts',
  '../area/y.ts',
  '../../../src/x.ts',
  'node:test',
  '@modelcontextprotocol/server',
];

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

describe('Given rule D2 without the former work-slice exception', () => {
  it('when the unit test of the work-slice fetch lines names a work-slice entry point, then the import is refused', async () => {
    await assertForbidden('test/unit/work-slice/observe-fetches.test.ts', [
      '../../acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts',
      '../../acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts',
    ]);
    await assertAllowed('test/unit/work-slice/observe-fetches.test.ts', ['../../support/doubles/mcp/fetch-operation-spy.ts']);
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
