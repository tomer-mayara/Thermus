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
];
