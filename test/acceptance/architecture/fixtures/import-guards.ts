import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';

export const eslint = new ESLint({ overrideConfigFile: resolve('.habit-hooks/eslint.config.mjs') });

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

export async function assertForbidden(filePath: string, paths: readonly string[]): Promise<void> {
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

export async function assertAllowed(filePath: string, paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    for (const [name, source] of forbiddenForms) {
      const [result] = await eslint.lintText(source(path), { filePath });
      assert.equal(result.errorCount, 0, `${filePath}: ${name} of ${path}: ${JSON.stringify(result.messages)}`);
    }
  }
}
