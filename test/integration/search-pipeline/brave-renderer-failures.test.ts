import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchEngineBraveHttp } from '../../../src/pipelines/providers/search-engine/search-engine-brave-http.ts';
import { WebsiteFetchHttpError, WebsiteFetchLaunchError, WebsiteFetchReadinessTimeoutError } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';

for (const [label, failure] of [
  ['an HTTP 429 refusal', new WebsiteFetchHttpError(429)],
  ['a missing renderer', new WebsiteFetchLaunchError('ENOENT', 'Renderer setup detail')],
  ['a renderer readiness timeout', new WebsiteFetchReadinessTimeoutError()],
] as const) {
  test(`Given ${label}, when the Brave engine calls the renderer, then the typed renderer failure stays distinct from provider classification failure`, async () => {
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => { throw failure; } });

    await assert.rejects(engine.search('lightpanda browser', new AbortController().signal), (error) => error === failure);
  });
}
