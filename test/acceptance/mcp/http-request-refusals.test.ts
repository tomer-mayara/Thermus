import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { openSite } from '../../support/in-process/mcp-request-isolation-site.ts';
import { call, assertSuccess, assertRecord } from '../../support/dsl/mcp-request-isolation.ts';

for (const era of mcpProtocolEras) {
  for (const refusal of ['authentication', 'access'] as const) {
    test(`Given a prior success in ${era}, when ${refusal} refuses the next call, then no prior trusted context reaches the tool`, { timeout: 5_000 }, async (t) => {
      const site = await openSite(t, era);
      const alice = await site.connect('alice');
      site.pages.alice.finish.resolve();
      assertSuccess(await call(alice, 'alice'), 'alice');
      if (refusal === 'authentication') site.access.invalid = true;
      else site.access.deny = true;
      await assert.rejects(call(alice, 'bob'));
      assert.equal(site.operationContexts.length, 1);
      const previousContext = site.operationContexts[0];
      assert.ok(previousContext);
      assert.equal(previousContext.user.subject, 'alice');
      assert.deepEqual(site.pipelineUrls, ['https://pages.example/alice']);
      assert.equal(site.records.length, 1);
      assertRecord(site.records[0], 'alice', 'success');
    });
  }
}
