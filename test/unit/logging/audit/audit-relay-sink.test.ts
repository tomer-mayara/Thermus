import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { AuditRelaySink, type AuditRelay, type AuditRelayOptions } from '../../../../src/logs/audit/audit-relay-sink.ts';
import type { AuditSendOutcome } from '../../../../src/logs/audit/audit-send.ts';

const target = new URL('http://thermus-control-plane:8080/internal/audit');
const tenantA = 'workos:client_01CONTROL:org_01A';
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const transient: AuditSendOutcome = { kind: 'transient_failure', reason: 'http_status', statusCode: 503 };

function eventOf(organizationId = tenantA, subject = 'user_01A'): AuditEvent {
  return Object.freeze({
    eventName: 'audit.destination.changed', timestamp: '2026-10-27T12:00:00.000Z', organizationId,
    actor: Object.freeze({ authority: 'workos:client_01CONTROL', subject }), action: 'save', outcome: 'saved',
  });
}

interface RelayPost extends AuditRelay {
  readonly signal: AbortSignal;
}

// A post that the test answers: by default each relay is accepted at once; held posts settle only on their abort.
function sinkWith(options: AuditRelayOptions = {}, answer: (post: RelayPost) => Promise<AuditSendOutcome> = async () => ({ kind: 'accepted' })) {
  const posts: RelayPost[] = [];
  const sink = new AuditRelaySink(target, { ...options, post: (relay, signal) => {
    const post = { ...relay, signal };
    posts.push(post);
    return answer(post);
  } });
  return { sink, posts };
}

function held(post: RelayPost): Promise<AuditSendOutcome> {
  return new Promise((resolve) => post.signal.addEventListener('abort', () => resolve({ kind: 'cancelled' }), { once: true }));
}

describe('Audit relay sink of a tenant', () => {
  test('Given an event of a request, when the sink of its context admits it, then admission returns at once without a send, and one later send posts the event with the same context to /internal/audit of the control plane', async (t) => {
    const { sink, posts } = sinkWith();
    t.after(() => sink.close());

    assert.equal(sink.forContext('context-of-request-a').writeAuditEvent(eventOf()), true);
    assert.equal(posts.length, 0);
    await turn();

    assert.equal(posts.length, 1);
    assert.deepEqual([posts[0]?.target.href, posts[0]?.context, JSON.parse(posts[0]?.body ?? '{}')], [target.href, 'context-of-request-a', eventOf()]);
  });

  test('Given a refused relay, when the control plane answers with a permanent failure, then the event drops after one attempt', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let now = 0;
    const { sink, posts } = sinkWith({ now: () => now }, async () => ({ kind: 'permanent_failure', reason: 'http_status', statusCode: 403 }));
    t.after(() => sink.close());

    sink.forContext('context-a').writeAuditEvent(eventOf());
    await turn();
    now = 30_000; t.mock.timers.tick(30_000); await turn();

    assert.equal(posts.length, 1);
  });

  test('Given a failed relay, when each attempt fails, then the sink tries 3 times with a backoff of 250 ms and 500 ms and then drops the event', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let now = 0;
    const { sink, posts } = sinkWith({ now: () => now, random: () => 0 }, async () => transient);
    t.after(() => sink.close());

    sink.forContext('context-a').writeAuditEvent(eventOf());
    await turn();
    now = 249; t.mock.timers.tick(249); await turn();
    assert.equal(posts.length, 1);
    now = 250; t.mock.timers.tick(1); await turn(); await turn();
    assert.equal(posts.length, 2);
    now = 750; t.mock.timers.tick(500); await turn(); await turn();
    assert.equal(posts.length, 3);
    now = 30_000; t.mock.timers.tick(29_250); await turn();

    assert.equal(posts.length, 3);
    assert.ok(posts.every((post) => post.context === 'context-a'));
  });

  test('Given a slow relay that never settles, when the event reaches its age of 30 s, then the attempt is aborted, the event drops, and the next event can go', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let now = 0;
    const { sink, posts } = sinkWith({ now: () => now }, (post) => posts.length === 1 ? held(post) : Promise.resolve({ kind: 'accepted' }));
    t.after(() => sink.close());

    sink.forContext('context-a').writeAuditEvent(eventOf());
    await turn();
    now = 10_000; t.mock.timers.tick(10_000);
    sink.forContext('context-b').writeAuditEvent(eventOf());
    now = 30_000; t.mock.timers.tick(20_000); await turn(); await turn();

    assert.equal(posts[0]?.signal.aborted, true);
    assert.deepEqual(posts.map((post) => post.context), ['context-a', 'context-b']);
  });

  test('Given the bounds of the audit collector, when one tenant has 16 pending events, then the sink refuses the 17th without a send', async (t) => {
    const { sink, posts } = sinkWith({}, held);
    t.after(() => sink.close());
    const relay = sink.forContext('context-a');

    const admitted = Array.from({ length: 17 }, () => relay.writeAuditEvent(eventOf()));
    await turn();

    assert.deepEqual(admitted, [...Array.from({ length: 16 }, () => true), false]);
    assert.equal(posts.length, 1);
  });

  test('Given a full tenant table, an oversized event, or a full byte budget, when another event arrives, then the sink refuses it', (t) => {
    const event = eventOf();
    const bytes = Buffer.byteLength(JSON.stringify(event)) + Buffer.byteLength('context-a');
    const { sink } = sinkWith({ bounds: { tenants: 1, eventBytes: bytes, bytes: bytes * 2 } }, held);
    t.after(() => sink.close());
    const relay = sink.forContext('context-a');

    assert.deepEqual([relay.writeAuditEvent(event), relay.writeAuditEvent(eventOf('workos:client_01CONTROL:org_01B'))], [true, false]);
    assert.equal(relay.writeAuditEvent(eventOf(tenantA, 'u'.repeat(200))), false);
    assert.deepEqual([relay.writeAuditEvent(event), relay.writeAuditEvent(event)], [true, false]);
  });

  test('Given events of several tenants and a slow relay, when they wait, then the sink sends one event of each tenant at a time and two in all', async (t) => {
    const { sink, posts } = sinkWith({}, held);
    t.after(() => sink.close());
    const relay = sink.forContext('context-a');

    for (const organization of ['org_01A', 'org_01A', 'org_01B', 'org_01C']) relay.writeAuditEvent(eventOf(`workos:client_01CONTROL:${organization}`));
    await turn();

    assert.deepEqual(posts.map((post) => JSON.parse(post.body).organizationId), ['workos:client_01CONTROL:org_01A', 'workos:client_01CONTROL:org_01B']);
  });

  test('Given a closed sink, when it closes and events arrive later, then it aborts its open attempt and refuses each later event', async () => {
    const { sink, posts } = sinkWith({}, held);
    const relay = sink.forContext('context-a');
    relay.writeAuditEvent(eventOf());
    relay.writeAuditEvent(eventOf());
    await turn();

    sink.close();
    await turn();

    assert.equal(posts[0]?.signal.aborted, true);
    assert.equal(relay.writeAuditEvent(eventOf()), false);
    assert.equal(posts.length, 1);
  });

  test('Given an empty context, an event without a tenant, or a post that throws, when the sink gets the event, then it never throws: the tool call keeps its result', async (t) => {
    const { sink, posts } = sinkWith({}, () => { throw new Error('The relay transport broke'); });
    t.after(() => sink.close());

    assert.equal(sink.forContext('').writeAuditEvent(eventOf()), false);
    assert.equal(sink.forContext('context-a').writeAuditEvent(eventOf('')), false);
    assert.equal(sink.forContext('context-a').writeAuditEvent(eventOf()), true);
    await turn(); await turn();

    assert.equal(posts.length, 1);
    assert.equal(sink.forContext('context-a').writeAuditEvent(eventOf()), true);
  });
});
