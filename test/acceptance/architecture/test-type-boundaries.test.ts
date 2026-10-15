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
const workSliceEntry = '../../acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch';

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
