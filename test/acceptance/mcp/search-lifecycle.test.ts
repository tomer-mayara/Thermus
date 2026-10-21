import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { openSearchSite } from '../../support/in-process/mcp-search-site.ts';
import { controlledRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';

for (const era of mcpProtocolEras) {
  test(`Given a public search renderer in ${era}, when the server closes, then shutdown waits for renderer cleanup and records cancellation once`, { timeout: 5_000 }, async (t) => {
    const renderer = controlledRenderer(t);
    const site = await openSearchSite(t, era, 'hosted');
    const response = site.client.callTool({ name: 'search', arguments: { query: 'private-shutdown-query', reason: 'private-shutdown-reason' } }).catch(() => undefined);
    await renderer.launched;
    const late = JSON.stringify({ url: 'https://search.brave.com/search?q=private-shutdown-query', http_status: 200, content: '<p>private-late-page</p>', error: null });
    t.after(() => renderer.finish(null, late, ''));
    let closed = false;
    const closing = site.server.close().then(() => { closed = true; });
    await setImmediate();
    assert.deepEqual(renderer.child.signals, ['SIGKILL']);
    assert.equal(closed, false);
    assert.deepEqual(site.completions(), []);
    renderer.finish(null, late, '');
    await closing;
    await site.client.close();
    await response;
    await site.server.close();
    assert.equal(site.completions().length, 1);
    assert.equal(site.completions()[0].tool, 'search');
    assert.equal(site.completions()[0].status, 'cancelled');
    assert.equal(site.stages().length, 1);
    assert.equal(site.stages()[0].operationId, site.completions()[0].operationId);
    assert.deepEqual(renderer.child.signals, ['SIGKILL']);
    assert.doesNotMatch(site.records.join('\n'), /private-shutdown-query|private-shutdown-reason|private-late-page/);
  });
}
