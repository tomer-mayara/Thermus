import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { openHostedFetchSite } from '../../support/in-process/hosted-fetch-site.ts';

const url = 'https://source.example/private-path?private-query=yes#private-fragment';

test('Given a hosted renderer that returns HTTP 404, when an authorized user fetches the page, then a safe failure diagnostic joins its completion by operation ID and the public error stays Page fetch failed', async (t) => {
  const site = await openHostedFetchSite(t);
  RendererProcessDouble.install(t);

  const result = await rpcResult(await site.application.handle(mcpRequest({
    url: site.config.mcpResourceUrl,
    method: 'tools/call',
    token: site.token,
    params: { name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the page' } },
  })));

  assert.deepEqual(result.content, [{ type: 'text', text: 'Page fetch failed' }]);
  assert.equal(result.isError, true);
  const completion = site.completions()[0];
  assert.equal(completion?.status, 'fetch_failed');
  const diagnostics = site.lines.filter((line) => line.startsWith('{"event":"renderer.fetch.failed"')).map((line) => JSON.parse(line));
  assert.deepEqual(diagnostics, [{
    event: 'renderer.fetch.failed', operationId: completion?.operationId,
    category: 'http', phase: 'renderer_result', httpStatus: 404,
    rendererErrorCode: 'HttpError', exitCode: 22,
  }]);
  const diagnosticText = JSON.stringify(diagnostics);
  for (const secret of [url, site.token, 'source.example', 'private-', '--json', 'spawn', 'content', 'stderr', 'stack', 'cause']) {
    assert.ok(!diagnosticText.includes(secret), `Failure diagnostics contain ${secret}`);
  }
});
