import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveAuditActorNameSite } from '../../../support/in-process/audit-actor-name-site.ts';

for (const tool of ['search', 'getURLAsMarkdown'] as const) {
  test(`Given an authorized WorkOS user with a trusted profile, when ${tool} completes with forged client names, then customer OTLP contains the profile name and original WorkOS ID`, async t => {
    const { records, user, call } = await serveAuditActorNameSite(t);
    const result = await call(tool);
    assert.deepEqual(result.content, [{ type: 'text', text: tool === 'search' ? 'public search' : 'public page' }]);
    assert.equal(records.length, 1);
    assert.equal(records[0]['actor.subject'].stringValue, user.id);
    assert.equal(records[0]['actor.authority'].stringValue, 'workos:client_test');
    assert.equal(records[0]['actor.name']?.stringValue, 'Zoë Example');
    assert.doesNotMatch(JSON.stringify(records), /forged|private-email/);
  });
}

for (const profile of ['unavailable', 'blank', 'control', 'oversized'] as const) {
  test(`Given an authorized WorkOS user with a ${profile} optional profile name, when a tool completes, then the event keeps the WorkOS ID without a display name`, async t => {
    const { site, records, user, call } = await serveAuditActorNameSite(t);
    site.world.fake.answer(`GET /user_management/users/${user.id}`, profile === 'unavailable' ? { status: 503 } : {
      status: 200, body: { id: user.id, first_name: ({ blank: ' ', control: 'bad\nname', oversized: 'é'.repeat(513) })[profile], last_name: null },
    });
    assert.deepEqual((await call('search')).content, [{ type: 'text', text: 'public search' }]);
    assert.equal(records.length, 1);
    assert.equal(records[0]['actor.subject'].stringValue, user.id);
    assert.equal(records[0]['actor.name'], undefined);
    assert.doesNotMatch(JSON.stringify(records), /forged|private-email/);
  });
}
