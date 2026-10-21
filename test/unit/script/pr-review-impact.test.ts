import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { impactOf, impactReasons } = await import(new URL('impact.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/impact.ts');
const revisions = { mergeBase: 'a'.repeat(40), head: 'b'.repeat(40) };
const declaration = {
  version: 1, base: revisions.mergeBase, head: revisions.head,
  classification: { container: false, external: false, contract: false, deployment: false, crossCutting: false, component: false, internalInterface: false, sensitiveBehavior: false, dependencyRisk: false, policy: false, uncertain: false },
  architecture: { modelUpdated: false, summary: 'The runtime remains the same.', views: ['Runtime'], evidence: ['src/index.ts'] },
};

function readImpact(t: TestContext, value: unknown) {
  const path = join(dataDirectory(t), 'impact.json');
  writeFileSync(path, JSON.stringify(value));
  return impactOf(path, revisions);
}

test('Given evidence of another candidate or base, when it is read, then the author must refresh it', (t) => {
  assert.throws(() => readImpact(t, { ...declaration, head: 'c'.repeat(40) }), /must have version 1, base/);
  assert.throws(() => readImpact(t, { ...declaration, base: 'c'.repeat(40) }), /must have version 1, base/);
});

test('Given an omitted impact claim or an empty architecture explanation, when it is read, then the omission cannot default to T0 Auto merge', (t) => {
  assert.throws(() => readImpact(t, { ...declaration, classification: {} }), /every classification flag/);
  assert.throws(() => readImpact(t, { ...declaration, architecture: { ...declaration.architecture, summary: ' ' } }), /summary, checked views, and evidence/);
});

test('Given unresolved classification, when the reasons are assessed, then T1 Team review and a merge blocker are both retained', (t) => {
  const impact = readImpact(t, { ...declaration, classification: { ...declaration.classification, uncertain: true } });
  const reasons = impactReasons(impact);
  assert.ok(reasons.some((reason) => reason.tier === 'T1'));
  assert.ok(reasons.some((reason) => reason.blocking));
});

for (const flag of ['container', 'external', 'contract', 'deployment', 'crossCutting'] as const) {
  test(`Given a declared ${flag} change, when impact is assessed, then it requires T2 Need architect`, (t) => {
    const impact = readImpact(t, { ...declaration, classification: { ...declaration.classification, [flag]: true } });
    assert.deepEqual(impactReasons(impact), [{ tier: 'T2', key: `impact.${flag}`, fact: declaration.architecture.summary }]);
  });
}
