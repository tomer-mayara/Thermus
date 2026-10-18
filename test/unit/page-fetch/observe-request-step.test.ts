import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ObserveRequestStep } from '../../../src/page-fetch/observe-request-step.ts';

for (const input of ['HTTPS://Example.COM:443/a%2fb?q=%2f#Part', 'https://example.com/😃']) {
  test(`Given the observation step and ${input}, when it executes, then it allows the exact input with only the standard result fields`, async () => {
    const step = new ObserveRequestStep();

    assert.deepEqual(await step.execute(input, new AbortController().signal), { decision: 'allow', output: input });
  });
}
