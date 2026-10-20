import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const sourceFiles = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.mjs',
  '**/*.cjs',
];

const providerPackages = '(?:better-auth|@better-auth/mcp|@workos-inc/node)(?:/|$)';
const providerPaths = '(?:local-auth/better-auth(?:/|$)|hosted-auth/workos(?:/|$))';
const sharedImports = [
  providerPackages,
  `(?:\\./|(?:\\.\\./)+auth/)${providerPaths}`,
  '(?:\\.\\./)+(?:mcp/|hosted-admin/|http/(?!client-address(?:\\.[jt]s)?$))',
  '@modelcontextprotocol/(?:server|client)(?:/|$)',
];
const localImports = [
  providerPackages,
  `(?:\\.\\./|(?:\\.\\./)+auth/)${providerPaths}`,
  '\\./better-auth(?:/|$)',
];
const consumerImports = [
  providerPackages,
  `(?:\\.\\./)+auth/(?:${providerPaths}|local-auth/local-auth-command(?:-line)?(?:\\.[jt]s)?$)`,
];
const pageFetchImports = [
  ...consumerImports,
  '@modelcontextprotocol/(?:server|client)(?:/|$)',
  '(?:adblock-rs|agent-input-sanitizer|defuddle)(?:/|$)',
  '@opentelemetry/(?:sdk-logs|exporter-logs-otlp-http)(?:/|$)',
  '(?:\\.\\./)+(?:mcp/|http/|hosted-admin/|html-cleaner-pipeline/|logging/)',
  '(?:\\.\\./)+(?:application|fetch-tool|hosted-workos-application|hosted-renderer-startup|hosted-portal|index)(?:\\.[jt]s)?$',
  '(?:\\.\\./)+website-fetcher/(?!website-fetcher(?:\\.[jt]s)?$)',
];

const searchPipelineImports = [
  ...pageFetchImports,
  '(?:\\.\\./)+search-engine/(?!search-engine(?:\\.[jt]s)?$)',
  '(?:\\.\\./)+page-fetch/(?!(?:pipeline-step|execution-context|step-record|renderer-failure-reports)(?:\\.[jt]s)?$)',
];

function directImportRules(paths, message) {
  const regex = `^(?:${paths.join('|')})`;
  return {
    'no-restricted-imports': ['error', { patterns: [{ regex, message }] }],
    'no-restricted-syntax': [
      'error',
      { selector: `ImportExpression[source.type="Literal"][source.value=/${regex.replaceAll('/', '\\/')}/]`, message },
    ],
  };
}

const testLayout = 'docs/testing/test-code-layout.md';
const testTypes = ['unit', 'integration', 'interface', 'acceptance'];
const otherUnitPackageFixtures = '(?:\\.\\./)+(?:test/unit/)?(?!support/)[a-z-]+/fixtures/';
// Rule D6 covers each script that runs alone in a container. test-support-boundaries.test.ts takes the scripts that
// the sites send into containers from module-paths.ts, and it fails when this list does not name one of them.
const containerScripts = [
  'test/support/container/container-edge.ts',
  'test/support/container/container-page.ts',
  'test/support/container/container-probe.ts',
];

function testTypeImports(types) {
  return `(?:\\.\\./)+(?:test/)?(?:${types.join('|')})/`;
}

function otherTestTypeImports(type) {
  return testTypeImports(testTypes.filter((other) => other !== type));
}

function supportFolderImports(folders) {
  return `(?:\\.\\./)+(?:(?:test/)?support/)?(?:${folders.join('|')})/`;
}

export default [
  {
    files: sourceFiles,
    ignores: ['**/node_modules/**', '**/dist/**', 'coverage/**', 'tools/**'],
    languageOptions: { parser: tsparser },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'max-lines-per-function': [
        'error',
        { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'max-params': ['error', 3],
      complexity: ['error', 10],
      'max-depth': ['error', { max: 4 }],
      'max-lines': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
      'no-warning-comments': [
        'warn',
        { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**'],
    rules: { 'max-lines-per-function': 'off' },
  },
  {
    files: ['src/auth/access-context.ts', 'src/auth/identity-verifier.ts'],
    rules: directImportRules(sharedImports, 'Shared auth uses contracts, not provider or transport implementations.'),
  },
  {
    files: [
      'src/auth/local-auth/local-user-administration.ts',
      'src/auth/local-auth/local-auth-command.ts',
      'src/auth/local-auth/local-auth-command-line.ts',
    ],
    rules: directImportRules(localImports, 'Neutral local auth does not import provider implementations.'),
  },
  {
    files: ['src/mcp/**/*.ts', 'src/hosted-admin/**/*.ts'],
    rules: directImportRules(consumerImports, 'Auth consumers use role contracts. Composition roots select implementations.'),
  },
  {
    files: ['src/page-fetch/**/*.ts'],
    rules: directImportRules(pageFetchImports, 'Page fetch uses public contracts. Composition selects transport, renderer, cleaner, and logger implementations.'),
  },
  {
    files: ['src/search-pipeline/**/*.ts'],
    rules: directImportRules(searchPipelineImports, 'Search pipeline uses public contracts and shared execution helpers. Composition selects implementations.'),
  },
  // For the same rule, a block replaces the options of each block before it.
  // Thus each glob has one block with all of its patterns. The driver block and
  // the double and fixture block replace the support block for their files.
  // Thus they also have the D1 pattern. The container block replaces the support
  // block for its files, and its pattern also refuses each import that D1 refuses.
  {
    files: ['test/support/**/*.ts'],
    rules: directImportRules(
      [testTypeImports(testTypes)],
      `Rule D1 of ${testLayout}: support code imports only src, packages, and test/support.`,
    ),
  },
  {
    files: ['test/support/drivers/**/*.ts'],
    rules: directImportRules(
      [testTypeImports(testTypes), supportFolderImports(['dsl'])],
      `Rules D1 and D4 of ${testLayout}: a protocol driver imports only src, packages, and test/support. `
        + 'It imports no module from test/support/dsl/.',
    ),
  },
  {
    files: ['test/support/doubles/**/*.ts', 'test/support/fixtures/**/*.ts'],
    rules: directImportRules(
      [testTypeImports(testTypes), supportFolderImports(['dsl', 'drivers'])],
      `Rules D1 and D5 of ${testLayout}: a support double or fixture imports only src, packages, and test/support. `
        + 'It imports no module from test/support/dsl/ or test/support/drivers/.',
    ),
  },
  {
    files: ['test/unit/**/*.ts'],
    rules: directImportRules(
      [otherTestTypeImports('unit'), otherUnitPackageFixtures],
      `Rules D2 and D3 of ${testLayout}: a unit test imports no other test type, and fixtures only from its own package.`,
    ),
  },
  ...['integration', 'interface', 'acceptance'].map((type) => ({
    files: [`test/${type}/**/*.ts`],
    rules: directImportRules(
      [otherTestTypeImports(type)],
      `Rule D2 of ${testLayout}: a file in test/${type}/ imports no other test type.`,
    ),
  })),
  {
    files: containerScripts,
    rules: directImportRules(
      ['(?!node:).'],
      `Rule D6 of ${testLayout}: a container script imports only node: modules, because it runs alone in a container.`,
    ),
  },
  // Keep this block last. Then no block after it can replace its selector. For
  // a test file in test/support, this block replaces the dynamic import guards
  // of the blocks before it. This is not a problem, because this block refuses
  // the whole file.
  {
    files: ['test/support/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: `Rule D7 of ${testLayout}: no test file lives under test/support/. `
            + 'The tests of support code live in test/unit/test-support/.',
        },
      ],
    },
  },
];
