import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { createRequestContext } from '../../../src/accounts/identity/access-context.ts';
import { createHostedToolOperations, createToolOperations } from '../../../src/app/fetch-tool.ts';
import { ObserveRequestStep } from '../../../src/pipelines/execution/observe-request-step.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { trustedAdRulesFile } from '../../support/fixtures/ad-rules.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

const context = createRequestContext({ user: { authority: 'https://synthetic.example/', subject: 'reader' }, tenantId: 'workspace', grants: [{ role: 'reader', permissions: ['product:access'] }] });
const environment = { AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: '/opt/thermus-test/lightpanda' };
const logger = { info: (_line: string) => {}, error: (_line: string) => {} };
const html = readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8');

test('Given OPERATION_CAPACITY=2, when the hosted operations hold a fetch and a search and a third call arrives, then the third call is busy and both held calls complete', { timeout: 5_000 }, async (t) => {
  const renderer = RendererProcessDouble.install(t);
  const fetchUrl = 'https://page.test/';
  const searchUrl = 'https://search.brave.com/search?q=query';
  renderer.serve(fetchUrl, { finalUrl: fetchUrl, html: '<html><body><h1>Page title</h1><p>Page content.</p></body></html>' });
  renderer.serve(searchUrl, { finalUrl: searchUrl, html });
  const held: PromiseWithResolvers<void>[] = [];
  const observe = ObserveRequestStep.prototype.execute;
  t.mock.method(ObserveRequestStep.prototype, 'execute', async function (this: ObserveRequestStep, ...args: Parameters<typeof observe>) {
    const gate = Promise.withResolvers<void>();
    held.push(gate);
    await gate.promise;
    return observe.apply(this, args);
  });
  t.after(() => { for (const gate of held) gate.resolve(); });
  const operations = createHostedToolOperations({ ...environment, OPERATION_CAPACITY: '2' }, logger);
  const fetch = operations.fetch(fetchUrl, context, executionContextOf());
  const search = operations.search('query', context, executionContextOf());
  const early = Promise.race([fetch, search]).then(() => 'settled', () => 'settled');
  while (held.length < 2) assert.notEqual(await Promise.race([early, setImmediate('held')]), 'settled', 'A call settled before both calls were held');
  await assert.rejects(operations.fetch(fetchUrl, context, executionContextOf()), { message: 'Server busy. Try again later.' });
  for (const gate of held) gate.resolve();
  assert.match(await fetch, /Page content/);
  assert.equal((await search).status, 'released');
  assert.equal(held.length, 2);
});

test('Given an invalid OPERATION_CAPACITY, when each edition makes its operations, then the hosted operations stop with the rule and the self-hosted operations do not read the setting', () => {
  const invalid = { ...environment, OPERATION_CAPACITY: '0' };
  assert.throws(() => createHostedToolOperations(invalid, logger), { name: 'DeploymentConfigError', message: 'OPERATION_CAPACITY must be a whole number from 1 to 100.' });
  assert.doesNotThrow(() => createToolOperations(invalid, logger));
});
