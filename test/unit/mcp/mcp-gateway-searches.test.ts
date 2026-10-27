import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import type { ForwardedBody, ForwardedMessage } from '../../../src/interfaces/mcp/mcp-gateway-request.ts';
import { GatewaySearches } from '../../../src/interfaces/mcp/mcp-gateway-searches.ts';
import { controlledBody, fetchCall, gatewayOf, post } from './fixtures/gateway-harness.ts';

// The search limit of the gateway (SO-05, answer 4 of 27 October 2026): 5 searches at a time across all tenants. The
// gateway tells a search from a fetch by the method and the tool name of each JSON-RPC message.

const searchMessage: ForwardedMessage = { id: 1, method: 'tools/call', toolName: 'search' };

function bodyOf(messages: readonly ForwardedMessage[]): ForwardedBody {
  return { messages, batch: messages.length > 1 };
}

test('Given 5 running searches, when a body without a search takes its places, then it fits: a fetch, a tool list, and a notification take no place', () => {
  const searches = new GatewaySearches();
  for (let search = 0; search < 5; search += 1) assert.ok(searches.take(bodyOf([searchMessage])));

  const others = bodyOf([{ id: 2, method: 'tools/call', toolName: 'getURLAsMarkdown' }, { id: 3, method: 'tools/list' }, { method: 'notifications/cancelled' }]);

  assert.ok(searches.take(others));
  assert.equal(searches.take(bodyOf([searchMessage])), undefined);
});

test('Given a batch with two searches, when it takes its places, then it needs two free places, and its release frees them one time', () => {
  const searches = new GatewaySearches();
  const held = [1, 2, 3, 4].map(() => searches.take(bodyOf([searchMessage])));
  const batch = bodyOf([searchMessage, { ...searchMessage, id: 2 }]);

  assert.equal(searches.take(batch), undefined);
  held[0]?.();
  const release = searches.take(batch);
  assert.ok(release);
  release();
  release();

  assert.ok(searches.take(batch));
  assert.equal(searches.take(bodyOf([searchMessage])), undefined, 'The second release freed nothing.');
});

test('Given 5 searches that run through the gateway, when a sixth search arrives, then it gets the search busy message without a forward, and a search after one ends is forwarded', async (t) => {
  const { forward, upstream, calls, log, tracked } = gatewayOf(t);
  const answers: Array<ReturnType<typeof controlledBody>> = [];
  upstream.answer = async () => {
    const answer = controlledBody();
    answer.send('event: message\ndata: started\n\n');
    answers.push(answer);
    return new Response(answer.body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
  const search = (id: number) => post({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'search', arguments: { query: `q${id}`, reason: 'Find it' } } });

  const running = await Promise.all([1, 2, 3, 4, 5].map((id) => forward(search(id))));
  const sixth = await forward(search(6));
  const fetchDuringBusy = await forward(post(fetchCall));
  answers[0]?.end();
  await running[0]?.text();
  await setImmediate();
  const seventh = await forward(search(7));

  assert.deepEqual(await sixth.json(), { jsonrpc: '2.0', id: 6, result: { content: [{ type: 'text', text: 'Server busy. Try again later.' }], isError: true, resultType: 'complete' } });
  assert.equal(fetchDuringBusy.status, 200);
  assert.equal(seventh.status, 200);
  assert.equal(calls.length, 7);
  assert.deepEqual(log.lines, ['INFO MCP gateway refusal: {"organizationId":"org_A","reason":"search-busy"}']);
  for (const answer of answers) answer.end();
  await Promise.all([...running.slice(1), fetchDuringBusy, seventh].map((response) => response.text()));
  await Promise.all(tracked);
});
