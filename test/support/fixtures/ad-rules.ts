import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from '../processes/module-paths.ts';

// The data files are not part of the build, so each path goes through the repository root of module-paths.ts (rule
// D8 of docs/testing/test-code-layout.md) and holds from the source tree and from dist/.
const supportFixtures = new URL('test/support/fixtures/', repositoryRoot);

export const elementHidingRules = readFileSync(new URL('element-hiding.filters.txt', supportFixtures), 'utf8');

export const trustedAdRulesFile = fileURLToPath(new URL('trusted-ad-rules.txt', supportFixtures));
