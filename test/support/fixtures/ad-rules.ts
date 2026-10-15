import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixturesDirectory = new URL(
  import.meta.url.endsWith('.ts') ? '../../unit/fixtures/' : '../../../../test/unit/fixtures/',
  import.meta.url,
);
const supportFixturesDirectory = new URL(
  import.meta.url.endsWith('.ts') ? './' : '../../../../test/support/fixtures/',
  import.meta.url,
);

export function readAdFixture(name: string): string {
  return readFileSync(new URL(name, fixturesDirectory), 'utf8');
}

export const elementHidingRules = readAdFixture('element-hiding.filters.txt');

export const trustedAdRulesFile = fileURLToPath(new URL('trusted-ad-rules.txt', supportFixturesDirectory));
