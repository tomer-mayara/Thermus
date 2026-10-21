import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { validationSelection } = await import(new URL('automation-selection.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/automation-selection.ts');

test('Given an ordinary prose change, when validation is selected, then it needs no executable suite or external credentialed gate', () => {
  assert.deepEqual(validationSelection(['docs/design/example.md', '.pr-impact.json']), { unit: false, buildTest: false, focusedUnit: false, focusedAcceptance: false, source: false, external: false });
});

test('Given unit tests change, when validation is selected, then it runs the complete unit group', () => {
  const selection = validationSelection(['test/unit/script/pr-automation.test.ts']);
  assert.equal(selection.unit, true);
  assert.equal(selection.focusedUnit, false);
  assert.equal(selection.focusedAcceptance, false);
});

test('Given acceptance tests change, when validation is selected, then offline checks cannot claim the full credentialed acceptance gate', () => {
  const selection = validationSelection(['test/acceptance/script/pr-automation.test.ts']);
  assert.equal(selection.external, true);
  assert.equal(selection.focusedAcceptance, true);
});

test('Given source changes, when validation is selected, then it runs available offline checks and still requires complete external gates', () => {
  assert.deepEqual(validationSelection(['src/index.ts']), { unit: true, buildTest: true, focusedUnit: false, focusedAcceptance: false, source: true, external: true });
});

test('Given a checker-only change, when validation is selected, then it selects existing focused checker tests', () => {
  assert.deepEqual(validationSelection(['script/pr-review/route.ts']), { unit: false, buildTest: false, focusedUnit: true, focusedAcceptance: true, source: false, external: false });
});

test('Given checker code and unit tests change together, when checks are selected, then the unit group is not run twice', () => {
  const selection = validationSelection(['script/pr-review/route.ts', 'test/unit/script/pr-review-route.test.ts']);
  assert.equal(selection.unit, true);
  assert.equal(selection.focusedUnit, false);
  assert.equal(selection.focusedAcceptance, true);
});

test('Given an unsupported executable or metrics change, when validation is selected, then missing coverage is explicit', () => {
  for (const path of ['script/new-tool.ts', 'script/code-quality/ast-metrics-process.ts', 'package.json', 'test/support/processes/helper.ts', '.ast-metrics.yaml', 'docs/example.ts', 'architecture/helper.py', 'docs/testing/test-list.md', 'script/code-quality/README.md']) {
    assert.equal(validationSelection([path]).external, true, path);
  }
});

test('Given the rule file changes, when validation is selected, then it runs focused checker tests and requires complete policy evidence', () => {
  const selection = validationSelection(['docs/implementation/pr-review-rules.yaml']);
  assert.equal(selection.focusedUnit, true);
  assert.equal(selection.focusedAcceptance, true);
  assert.equal(selection.external, true);
});
