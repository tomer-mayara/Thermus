import { readFileSync } from 'node:fs';
const fixturesDirectory = new URL(import.meta.url.endsWith('.ts') ? '../unit/fixtures/' : '../../../test/unit/fixtures/', import.meta.url);
export function readAdFixture(name) {
    return readFileSync(new URL(name, fixturesDirectory), 'utf8');
}
export const elementHidingRules = readAdFixture('element-hiding.filters.txt');
//# sourceMappingURL=ad-rules.js.map