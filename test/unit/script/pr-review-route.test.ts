import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { labelCommand, orderedReasons, routeOf } = await import(new URL('route.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/route.ts');

const reason = (route: 'FIX' | 'ASK' | 'READ' | 'SHOW', fact: string) => ({ route, key: 'k', fact });

test('Given reasons of several routes, when the route is computed, then the first route of FIX, ASK, READ, SHOW with a reason applies, else SHIP', () => {
  assert.equal(routeOf([reason('SHOW', 'a'), reason('READ', 'b'), reason('ASK', 'c')]), 'ASK');
  assert.equal(routeOf([reason('SHOW', 'a'), reason('FIX', 'b')]), 'FIX');
  assert.equal(routeOf([reason('SHOW', 'a')]), 'SHOW');
  assert.equal(routeOf([]), 'SHIP');
});

test('Given reasons in any order, when they are ordered, then they follow the route order and keep their order within a route', () => {
  assert.deepEqual(orderedReasons([reason('SHOW', 'a'), reason('ASK', 'b'), reason('FIX', 'c'), reason('ASK', 'd')]).map((entry) => entry.fact), ['c', 'b', 'd', 'a']);
});

test('Given a route, when the label command is made, then it adds the route label and removes each other route label', () => {
  assert.equal(labelCommand('READ', undefined), 'gh pr edit <n> --add-label route:read --remove-label route:fix --remove-label route:ask --remove-label route:show --remove-label route:ship');
  assert.equal(labelCommand('FIX', 'tomer-mayara/Thermus'), 'gh pr edit <n> --repo tomer-mayara/Thermus --add-label route:fix --remove-label route:ask --remove-label route:read --remove-label route:show --remove-label route:ship');
});
