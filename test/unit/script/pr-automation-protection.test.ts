import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { protectionBlockers, isControllerCheck } = await import(new URL('automation-protection.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/automation-protection.ts');
const protection = {
  required_status_checks: { strict: true, checks: [{ context: 'candidate-validation', app_id: 15368 }] },
  enforce_admins: { enabled: true }, allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false },
};

test('Given strict protection tied to trusted validation, when the base advances during merge, then GitHub must require fresh up-to-date checks', () => {
  assert.deepEqual(protectionBlockers(protection, 15368), []);
  assert.ok(protectionBlockers({ ...protection, required_status_checks: { ...protection.required_status_checks, strict: false } }, 15368).length > 0);
});

test('Given missing, spoofable, or bypassable protection, when the gate checks it, then automatic merge is blocked', () => {
  for (const value of [
    {},
    { ...protection, enforce_admins: { enabled: false } },
    { ...protection, required_status_checks: { strict: true, checks: [{ context: 'candidate-validation', app_id: -1 }] } },
    { ...protection, required_pull_request_reviews: { bypass_pull_request_allowances: { apps: [{}] } } },
  ]) assert.ok(protectionBlockers(value, 15368).length > 0);
});

test('Given a check that resembles the controller, when pending jobs are filtered, then only this exact trusted run is excluded', () => {
  const check = { name: 'merge-gate', app: { slug: 'github-actions' }, details_url: 'https://github.com/owner/repo/actions/runs/123/job/456' };
  assert.equal(isControllerCheck(check, '123', 'owner/repo'), true);
  assert.equal(isControllerCheck(check, '124', 'owner/repo'), false);
  assert.equal(isControllerCheck({ ...check, app: { slug: 'other-app' } }, '123', 'owner/repo'), false);
  assert.equal(isControllerCheck({ ...check, details_url: 'https://elsewhere.example/owner/repo/actions/runs/123/job/456' }, '123', 'owner/repo'), false);
});
