import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AcceptedRelays } from '../../../src/interfaces/web/internal/accepted-relays.ts';

function relaysAt() {
  let now = 1_000_000;
  return { relays: new AcceptedRelays(() => now), advance: (ms: number) => { now += ms; } };
}

test('Given an accepted relay, when the same operation ID of the same tenant comes again within 160 s, then it is a repeat, and after 160 s it is new', () => {
  const { relays, advance } = relaysAt();

  assert.equal(relays.admit('workos:client:org_A', 'operation-1'), 'new');
  advance(159_999);
  assert.equal(relays.admit('workos:client:org_A', 'operation-1'), 'repeated');
  advance(1);
  assert.equal(relays.admit('workos:client:org_A', 'operation-1'), 'new');
});

test('Given an accepted relay, when another tenant relays the same operation ID, then it is new', () => {
  const { relays } = relaysAt();

  relays.admit('workos:client:org_A', 'operation-1');

  assert.equal(relays.admit('workos:client:org_B', 'operation-1'), 'new');
});

test('Given a full memory, when a new relay comes, then old entries are forgotten first, and without an old entry the relay finds no place', () => {
  const { relays, advance } = relaysAt();
  for (let index = 0; index < 16_384; index += 1) relays.admit('workos:client:org_A', `operation-${index}`);

  assert.equal(relays.admit('workos:client:org_A', 'operation-new'), 'full');
  assert.equal(relays.admit('workos:client:org_A', 'operation-0'), 'repeated');
  advance(160_000);
  assert.equal(relays.admit('workos:client:org_A', 'operation-new'), 'new');
});
