import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openMcpAuditSite, type AuditToolOutcome } from '../../support/in-process/mcp-audit-site.ts';

for (const outcome of ['success', 'empty success', 'safe error', 'cancelled', 'withheld'] satisfies AuditToolOutcome[]) {
  test(`Given enabled customer capture in organization A, when a tool has ${outcome}, then only its validated input and final public outcome reach A's customer sink`, async (t) => {
    const site = await openMcpAuditSite(t, outcome);
    const search = outcome === 'withheld';
    const args = search ? { query: 'PRIVATE distinctive query', reason: 'PRIVATE distinctive reason' } : { url: 'https://example.com/PRIVATE-path', reason: 'PRIVATE distinctive reason' };
    const result = await site.client.callTool({ name: search ? 'search' : 'getURLAsMarkdown', arguments: args, _meta: { organizationId: 'organization-b', subject: 'PRIVATE forged actor' } });
    const expectedText = ({ success: '# PRIVATE final Markdown\n', 'empty success': '', 'safe error': 'Page fetch failed: HTTP 429', cancelled: 'Request cancelled', withheld: 'Search content withheld' })[outcome];
    assert.deepEqual(result.content, [{ type: 'text', text: expectedText }]);
    assert.equal(site.events.length, 1);
    const event = site.events[0];
    assert.equal(event.eventName, 'mcp.tool.completed');
    assert.equal(event.organizationId, 'organization-a');
    assert.deepEqual(event.actor, { authority: 'trusted-authority', subject: 'trusted-actor' });
    if (event.eventName !== 'mcp.tool.completed') throw new Error('Expected a tool completion');
    assert.deepEqual(event.input, args);
    assert.equal(event.result.text, result.content[0].type === 'text' ? result.content[0].text : undefined);
    assert.equal(event.status, ({ success: 'success', 'empty success': 'success', 'safe error': 'fetch_failed', cancelled: 'cancelled', withheld: 'withheld' })[outcome]);
    assert.equal(site.operations(), 1);
    assert.doesNotMatch(JSON.stringify(site.events), /intermediate HTML|renderer cancel cause|forged actor|organization-b|_meta/);
    assert.doesNotMatch(site.diagnostics.join('\n'), /PRIVATE|distinctive|example.com|query|reason|url/);
  });
}

for (const sink of ['throw', 'refuse'] as const) {
  test(`Given a customer sink that can ${sink}, when a tool completes, then its exact public result remains and the operation runs once`, async (t) => {
    const site = await openMcpAuditSite(t, 'success', sink);
    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url: 'https://example.com/PRIVATE-path', reason: 'PRIVATE reason' } });
    assert.deepEqual(result.content, [{ type: 'text', text: '# PRIVATE final Markdown\n' }]);
    assert.equal(result.isError, undefined);
    assert.equal(site.operations(), 1);
    assert.deepEqual(site.events, []);
    assert.doesNotMatch(site.diagnostics.join('\n'), /PRIVATE|example.com|reason|url/);
  });
}

test('Given customer capture for two trusted tenants, when each tenant calls a tool and names the other tenant in metadata, then each completion belongs to its authenticated tenant', async (t) => {
  const site = await openMcpAuditSite(t, 'success');
  const second = await site.connect('organization-b');
  await Promise.all([
    site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url: 'https://example.com/PRIVATE-a', reason: 'PRIVATE a' }, _meta: { tenantId: 'organization-b' } }),
    second.callTool({ name: 'search', arguments: { query: 'PRIVATE b', reason: 'PRIVATE b' }, _meta: { tenantId: 'organization-a' } }),
  ]);
  assert.equal(site.events.length, 2);
  const firstEvent = site.events.find((event) => event.organizationId === 'organization-a');
  const secondEvent = site.events.find((event) => event.organizationId === 'organization-b');
  assert.equal(firstEvent?.actor.subject, 'trusted-actor');
  assert.equal(secondEvent?.actor.subject, 'trusted-actor-b');
  assert.doesNotMatch(JSON.stringify(firstEvent), /PRIVATE b/);
  assert.doesNotMatch(JSON.stringify(secondEvent), /PRIVATE-a|PRIVATE a/);
  assert.doesNotMatch(site.diagnostics.join(''), /PRIVATE/);
});
