import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import fs, { readFileSync } from 'node:fs';
import childProcess from 'node:child_process';
import { parseHTML } from 'linkedom';
import { micromark } from 'micromark';
import { CleanHtmlAdsAdblockRs } from '../../src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { PromptInjectionRemoverSanitizer } from '../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { ObserveRequestStep } from '../../src/pipelines/execution/observe-request-step.ts';
import { syncBuiltinMocks } from '../support/doubles/website-fetcher/builtin-mocks.ts';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { createRequestContext } from '../../src/accounts/identity/access-context.ts';
import { createHostedToolOperations, createToolOperations } from '../../src/app/fetch-tool.ts';
import { RendererProcessDouble } from '../support/doubles/website-fetcher/renderer-process-double.ts';
import { executionContextOf } from '../support/fixtures/execution-context.ts';
import { repositoryRoot } from '../support/processes/module-paths.ts';
import { trustedAdRulesFile } from '../support/fixtures/ad-rules.ts';

const context = createRequestContext({ user: { authority: 'https://synthetic.example/', subject: 'reader' }, tenantId: 'workspace', grants: [{ role: 'reader', permissions: ['product:access'] }] });
const environment = { AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: '/opt/thermus-test/lightpanda' };
const logger = { info: (_line: string) => {}, error: (_line: string) => {} };
const html = readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8');

for (const first of ['fetch', 'search'] as const) {
  for (const late of ['success', 'failure'] as const) {
    test(`Given ${first} abandons DNS, when the other tool runs before late ${late}, then one shared guard refuses it and recovers after settlement`, { timeout: 5_000 }, async (t) => {
      const renderer = RendererProcessDouble.install(t);
      const answer = Promise.withResolvers<Array<{ address: string; family: number }>>();
      const started = Promise.withResolvers<void>();
      const lookup = t.mock.method(dns, 'lookup', () => { started.resolve(); return answer.promise; });
      const operations = createToolOperations(environment, logger);
      const controller = new AbortController();
      const initial = operations[first](first === 'fetch' ? 'https://pending.test/' : 'query', context, { ...executionContextOf(), signal: controller.signal });
      let cancelled = false;
      const rejected = assert.rejects(initial, { name: 'AbortError' }).then(() => { cancelled = true; });
      await started.promise;
      controller.abort();
      await setImmediate();
      assert.equal(cancelled, true, 'Caller cancellation must settle before native DNS');
      await rejected;
      const second = first === 'fetch' ? 'search' : 'fetch';
      await assert.rejects(operations[second](second === 'fetch' ? 'https://retry.test/' : 'query', context, executionContextOf()));
      assert.equal(lookup.mock.callCount(), 1);
      assert.equal(renderer.launches.length, 0);
      if (late === 'success') answer.resolve([{ address: '93.184.216.34', family: 4 }]);
      else answer.reject(new Error('Late DNS failure'));
      await setImmediate();
      lookup.mock.mockImplementation(async () => [{ address: '93.184.216.34', family: 4 }]);
      const url = second === 'fetch' ? 'https://retry.test/' : 'https://search.brave.com/search?q=query';
      renderer.serve(url, { finalUrl: url, html });
      await operations[second](second === 'fetch' ? url : 'query', context, executionContextOf());
      assert.equal(lookup.mock.callCount(), 2);
      assert.equal(renderer.launches.length, 1);
    });
  }
}

test('Given one concrete composition, when fetch and exact Unicode search run, then real cleaning preserves search results and records both operations', async (t) => {
  const renderer = RendererProcessDouble.install(t);
  const query = '  lightpanda + 東京 & ?  ';
  const searchUrl = `https://search.brave.com/search?${new URLSearchParams({ q: query })}`;
  renderer.serve(searchUrl, { finalUrl: searchUrl, html });
  const fetchUrl = 'https://page.test/';
  renderer.serve(fetchUrl, { finalUrl: fetchUrl, html: '<html><body><article><h1>Fetch title</h1><p>Fetch content remains available.</p></article></body></html>' });
  const records: string[] = [];
  const signals: AbortSignal[] = [];
  const observe = ObserveRequestStep.prototype.execute;
  t.mock.method(ObserveRequestStep.prototype, 'execute', function (this: ObserveRequestStep, ...args: Parameters<typeof observe>) {
    signals.push(args[1]);
    return observe.apply(this, args);
  });
  const fetchExecution = executionContextOf();
  const searchExecution = executionContextOf();
  const operations = createToolOperations(environment, { ...logger, info: (line) => records.push(line) });
  assert.match(await operations.fetch(fetchUrl, context, fetchExecution), /Fetch content/);
  const outcome = await operations.search(query, context, searchExecution);
  assert.equal(outcome.status, 'released');
  if (outcome.status === 'released') {
    const expected = JSON.parse(readFileSync(new URL('test/support/fixtures/search-engine/brave-results-expected.json', repositoryRoot), 'utf8')) as Array<{ title: string; url: string; snippet: string }>;
    const text = parseHTML(`<html><body>${micromark(outcome.markdown)}</body></html>`).document.body.textContent.replace(/\s+/g, ' ').trim();
    let previous = -1;
    for (const result of expected) {
      const position = text.indexOf(result.title, previous + 1);
      assert.ok(position > previous, result.title);
      assert.ok(outcome.markdown.includes(result.url), result.url);
      assert.ok(text.includes(result.snippet), result.snippet);
      previous = position;
    }
  }
  assert.deepEqual(signals, [fetchExecution.signal, searchExecution.signal]);
  assert.equal(renderer.launches.length, 2);
  assert.equal(renderer.launches[1].args.at(-1), searchUrl);
  assert.deepEqual(records.map((line) => JSON.parse(line).stepId), ['outgoing.observe_request', 'incoming.process_html', 'search.outgoing.observe_request', 'search.incoming.process_html']);
});


test('Given application-scoped resources, when both tools and a separate application run, then rules load once per pair and compatible cleaner and observer state is shared only within each pair', async (t) => {
  const renderer = RendererProcessDouble.install(t);
  const read = t.mock.method(fs, 'readFileSync');
  syncBuiltinMocks(t);
  const resources = [CleanHtmlAdsAdblockRs, PromptInjectionRemoverSanitizer, ObserveRequestStep];
  const owners = resources.map(() => [] as object[]);
  for (const [index, resource] of resources.entries()) {
    const method = resource === ObserveRequestStep ? 'execute' : 'invoke';
    const prototype = resource.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    const original = prototype[method];
    t.mock.method(prototype, method, function (this: object, ...args: unknown[]) {
      owners[index].push(this);
      return original.apply(this, args);
    });
  }
  const converters: object[] = [];
  const convert = CleanHtmlToMarkdownDefuddle.prototype.invoke;
  t.mock.method(CleanHtmlToMarkdownDefuddle.prototype, 'invoke', function (this: CleanHtmlToMarkdownDefuddle, ...args: Parameters<typeof convert>) {
    converters.push(this);
    return convert.apply(this, args);
  });
  const first = createToolOperations(environment, logger);
  const second = createToolOperations(environment, logger);
  assert.equal(read.mock.calls.filter(({ arguments: args }) => args[0] === trustedAdRulesFile).length, 2);
  const fetchUrl = 'https://page.test/';
  const searchUrl = 'https://search.brave.com/search?q=query';
  renderer.serve(fetchUrl, { finalUrl: fetchUrl, html: '<html><body><h1>Page title</h1><p>Page content.</p></body></html>' });
  renderer.serve(searchUrl, { finalUrl: searchUrl, html });
  await first.fetch(fetchUrl, context, executionContextOf());
  await first.search('query', context, executionContextOf());
  await second.fetch(fetchUrl, context, executionContextOf());
  for (const owner of owners) {
    assert.equal(owner.length, 3);
    assert.equal(owner[0], owner[1]);
    assert.notEqual(owner[0], owner[2]);
  }
  assert.equal(new Set(converters).size, 3);
  assert.equal(read.mock.calls.filter(({ arguments: args }) => args[0] === trustedAdRulesFile).length, 2);
});

test('Given renderer setup fails in both tools, when two applications call them, then setup reporting deduplicates within each application only', async (t) => {
  RendererProcessDouble.install(t);
  t.mock.method(childProcess, 'execFile', (() => { throw Object.assign(new Error('Private launch cause'), { code: 'ENOENT', syscall: 'spawn /opt/thermus-test/lightpanda' }); }) as unknown as typeof childProcess.execFile);
  syncBuiltinMocks(t);
  const lines: string[] = [];
  const log = { ...logger, error: (line: string) => lines.push(line) };
  const first = createToolOperations(environment, log);
  const second = createToolOperations(environment, log);
  await assert.rejects(first.fetch('https://page.test/', context, executionContextOf()));
  await assert.rejects(first.search('query', context, executionContextOf()));
  assert.equal(lines.filter((line) => line.startsWith('Renderer setup failure:')).length, 1);
  await assert.rejects(second.search('query', context, executionContextOf()));
  assert.equal(lines.filter((line) => line.startsWith('Renderer setup failure:')).length, 2);
  assert.equal(lines.filter((line) => line.startsWith('{')).length, 3);
});


test('Given abandoned DNS in one application, when another application searches, then it renders while the first application still refuses new DNS work', { timeout: 5_000 }, async (t) => {
  const renderer = RendererProcessDouble.install(t);
  const answer = Promise.withResolvers<Array<{ address: string; family: number }>>();
  const started = Promise.withResolvers<void>();
  const lookup = t.mock.method(dns, 'lookup', (hostname: string) => {
    if (hostname === 'pending.test') { started.resolve(); return answer.promise; }
    return Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
  });
  const first = createToolOperations(environment, logger);
  const second = createToolOperations(environment, logger);
  const controller = new AbortController();
  const rejected = assert.rejects(first.fetch('https://pending.test/', context, { ...executionContextOf(), signal: controller.signal }), { name: 'AbortError' });
  await started.promise;
  controller.abort();
  await rejected;
  const searchUrl = 'https://search.brave.com/search?q=query';
  renderer.serve(searchUrl, { finalUrl: searchUrl, html });
  assert.equal((await second.search('query', context, executionContextOf())).status, 'released');
  await assert.rejects(first.search('query', context, executionContextOf()));
  assert.equal(lookup.mock.callCount(), 2);
  assert.equal(renderer.launches.length, 1);
  answer.reject(new Error('Late DNS failure'));
  await setImmediate();
});

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
