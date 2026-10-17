import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statusOf } from '../../support/hosted-live/sdk-errors.ts';

test('Given an object with a numeric status, also an error of a refused SDK call, when statusOf reads it, then it gives that number', () => {
  assert.equal(statusOf({ status: 400 }), 400);
  assert.equal(statusOf(Object.assign(new Error('Not Found'), { status: 404 })), 404);
});

test('Given an object whose status is not a number, when statusOf reads it, then it gives that value unchanged', () => {
  for (const status of ['404', null, { code: 404 }]) assert.equal(statusOf({ status }), status);
});

test('Given an Error without a status, when statusOf reads it, then it gives undefined', () => {
  assert.equal(statusOf(new Error('The write failed.')), undefined);
});

test('Given null, undefined, or a string, when statusOf reads it, then it gives undefined', () => {
  assert.deepEqual([null, undefined, 'HTTP 404'].map((value) => statusOf(value)), [undefined, undefined, undefined]);
});
