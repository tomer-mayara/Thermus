import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from '../processes/module-paths.ts';

// The data files are not part of the build, so each path goes through the repository root of module-paths.ts (rule
// D8 of docs/testing/test-code-layout.md) and holds from the source tree and from dist/.
const unitFixtures = new URL('test/unit/fixtures/', repositoryRoot);
const supportFixtures = new URL('test/support/fixtures/', repositoryRoot);

export function readAdFixture(name: string): string {
  return readFileSync(new URL(name, unitFixtures), 'utf8');
}

export const elementHidingRules = readAdFixture('element-hiding.filters.txt');

export const trustedAdRulesFile = fileURLToPath(new URL('trusted-ad-rules.txt', supportFixtures));
