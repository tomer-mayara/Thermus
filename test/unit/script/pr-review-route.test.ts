import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { labelCommand, orderedReasons, routeOf } = await import(new URL('route.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/route.ts');

const reason = (route: 'FIX' | 'CLARIFICATION_NEEDED' | 'ARCHITECT_REVIEW_NEEDED', fact: string) => ({ route, key: 'k', fact });

test('Given reasons of several routes, when the route is computed, then the first route of FIX, CLARIFICATION_NEEDED, ARCHITECT_REVIEW_NEEDED with a reason applies, else SHIP', () => {
  assert.equal(routeOf([reason('ARCHITECT_REVIEW_NEEDED', 'a'), reason('ARCHITECT_REVIEW_NEEDED', 'b'), reason('CLARIFICATION_NEEDED', 'c')]), 'CLARIFICATION_NEEDED');
  assert.equal(routeOf([reason('ARCHITECT_REVIEW_NEEDED', 'a'), reason('FIX', 'b')]), 'FIX');
  assert.equal(routeOf([reason('ARCHITECT_REVIEW_NEEDED', 'a')]), 'ARCHITECT_REVIEW_NEEDED');
  assert.equal(routeOf([]), 'SHIP');
});

test('Given reasons in any order, when they are ordered, then they follow the route order and keep their order within a route', () => {
  assert.deepEqual(orderedReasons([reason('ARCHITECT_REVIEW_NEEDED', 'a'), reason('CLARIFICATION_NEEDED', 'b'), reason('FIX', 'c'), reason('CLARIFICATION_NEEDED', 'd')]).map((entry) => entry.fact), ['c', 'b', 'd', 'a']);
});

test('Given a route, when the label command is made, then it adds the route label and removes each other route label', () => {
  assert.equal(labelCommand('ARCHITECT_REVIEW_NEEDED', undefined), 'gh pr edit <n> --add-label route:architect_review_needed --remove-label route:fix --remove-label route:clarification_needed --remove-label route:ship --remove-label route:ask --remove-label route:read --remove-label route:show');
  assert.equal(labelCommand('FIX', 'tomer-mayara/Thermus'), 'gh pr edit <n> --repo tomer-mayara/Thermus --add-label route:fix --remove-label route:clarification_needed --remove-label route:architect_review_needed --remove-label route:ship --remove-label route:ask --remove-label route:read --remove-label route:show');
});
