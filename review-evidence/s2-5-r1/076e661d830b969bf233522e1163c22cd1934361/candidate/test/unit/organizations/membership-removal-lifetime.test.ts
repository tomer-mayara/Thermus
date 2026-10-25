import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OrganizationDirectory } from '../../../src/accounts/organizations/organization-directory.ts';
import { actor, request, removalFixture, removalTime, nextTurn } from './fixtures/membership-removal-fixtures.ts';

test('Given an unresolved initial authorization read, when the fixed 30-second total budget ends, then the caller returns unavailable and a late read cannot admit or delete', async (t) => {
  const time = removalTime(t);
  const { administration, directory, store, deletes } = removalFixture();
  const release = Promise.withResolvers<void>();
  const reached = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const original = directory.membershipsOf.bind(directory);
  directory.membershipsOf = async (user) => { reached.resolve(); await release.promise; return original(user); };
  let observed: string | undefined;
  const removing = administration.removeMember(actor, request).then(result => { observed = result; return result; });
  await reached.promise;
  time.advance(29_999);
  await nextTurn();
  assert.equal(observed, undefined);
  time.advance(1);
  await nextTurn();
  assert.equal(observed, 'unavailable');
  release.resolve();
  await removing;
  await nextTurn();
  assert.equal(store.admissions.length, 0);
  assert.deepEqual(deletes, []);
});

test('Given an admission whose commit is unresolved, when the total deadline passes, then a late admitted answer never dispatches and the hold remains', async (t) => {
  const time = removalTime(t);
  const { administration, store, deletes } = removalFixture();
  const release = Promise.withResolvers<void>();
  const reached = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const admit = store.admitRemoval.bind(store);
  store.admitRemoval = async (intent) => { await admit(intent); reached.resolve(); await release.promise; return { status: 'admitted' }; };
  let observed: string | undefined;
  const removing = administration.removeMember(actor, request).then(result => { observed = result; });
  await reached.promise;
  time.advance(30_000);
  await nextTurn();
  assert.equal(observed, 'unknown');
  release.resolve();
  await removing;
  await nextTurn();
  assert.deepEqual(deletes, []);
  assert.equal(store.operations.get('org-a')?.outcome, null);
});

for (const stop of ['deadline', 'close'] as const) {
  test(`Given an admitted removal paused in current member reads, when ${stop} stops its lifetime, then a late continuation cannot send or clear the hold`, async (t) => {
    const time = removalTime(t);
    const { administration, directory, store, deletes } = removalFixture();
    const release = Promise.withResolvers<void>();
    const reached = Promise.withResolvers<void>();
    t.after(() => release.resolve());
    const member = directory.member.bind(directory);
    directory.member = async (id) => { reached.resolve(); await release.promise; return member(id); };
    let observed: string | undefined;
    const removing = administration.removeMember(actor, request).then(result => { observed = result; });
    await reached.promise;
    if (stop === 'deadline') time.advance(30_000);
    else await administration.close();
    await nextTurn();
    assert.equal(observed, 'unknown');
    release.resolve();
    await removing;
    await nextTurn();
    assert.deepEqual(deletes, []);
    assert.equal(store.operations.get('org-a')?.outcome, null);
    assert.equal(store.completions.length, 0);
  });
}

test('Given a final member page that consumes the deadline, when its answer is returned, then the synchronous pre-send guard prevents deletion', async (t) => {
  const time = removalTime(t);
  const { administration, directory, deletes, store } = removalFixture();
  const page = directory.memberFactsPage.bind(directory);
  directory.memberFactsPage = async (query) => {
    const result = await page(query);
    if (result.next === undefined) time.advance(30_000);
    return result;
  };
  assert.equal(await administration.removeMember(actor, request), 'unknown');
  assert.deepEqual(deletes, []);
  assert.equal(store.operations.get('org-a')?.outcome, null);
});

test('Given a possibly live provider deletion, when shutdown stops the coordinator and a positive reply arrives later, then it stays unknown and held with no retry or late completion', async (t) => {
  removalTime(t);
  const { administration, directory, store } = removalFixture();
  const release = Promise.withResolvers<void>();
  const reached = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  let deletes = 0;
  directory.deleteMembership = async () => { deletes++; reached.resolve(); await release.promise; return { outcome: 'applied' }; };
  let observed: string | undefined;
  const removing = administration.removeMember(actor, request).then(result => { observed = result; });
  await reached.promise;
  await administration.close();
  await nextTurn();
  assert.equal(observed, 'unknown');
  assert.equal(await administration.removeMember(actor, request), 'unavailable');
  release.resolve();
  await removing;
  await nextTurn();
  assert.equal(deletes, 1);
  assert.equal(store.operations.get('org-a')?.outcome, null);
  assert.equal(store.completions.length, 0);
});

test('Given provider success and a stalled final commit, when the total deadline ends, then no success is returned and no further read or write starts', async (t) => {
  const time = removalTime(t);
  const { administration, store } = removalFixture();
  const release = Promise.withResolvers<void>();
  const reached = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  store.completeRemoval = async () => { reached.resolve(); await release.promise; return { status: 'unconfirmed' }; };
  let reads = 0;
  store.readRemoval = async () => { reads++; return { status: 'absent' }; };
  let observed: string | undefined;
  const removing = administration.removeMember(actor, request).then(result => { observed = result; });
  await reached.promise;
  time.advance(30_000);
  await nextTurn();
  assert.equal(observed, 'unknown');
  release.resolve();
  await removing;
  await nextTurn();
  assert.equal(reads, 0);
  assert.equal(store.operations.get('org-a')?.outcome, null);
});

test('Given slow authorization, admission, and current reads, when their combined time consumes the budget, then a new phase does not reset the deadline', async (t) => {
  const time = removalTime(t);
  const { administration, directory, store, deletes } = removalFixture();
  const memberships = directory.membershipsOf.bind(directory);
  directory.membershipsOf = async user => { time.advance(10_000); return memberships(user); };
  const admit = store.admitRemoval.bind(store);
  store.admitRemoval = async intent => { time.advance(10_000); return admit(intent); };
  assert.equal(await administration.removeMember(actor, request), 'unknown');
  assert.deepEqual(deletes, []);
  assert.equal(directory.memberFactsPageReads.length, 0);
  assert.equal(store.operations.get('org-a')?.outcome, null);
});

test('Given shutdown before an initial authorization read completes, when it later resolves, then no admission occurs and repeated close remains safe', async (t) => {
  removalTime(t);
  const { administration, directory, store } = removalFixture();
  const release = Promise.withResolvers<void>();
  const reached = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const memberships = directory.membershipsOf.bind(directory);
  directory.membershipsOf = async user => { reached.resolve(); await release.promise; return memberships(user); };
  const removing = administration.removeMember(actor, request);
  await reached.promise;
  await administration.close();
  await administration.close();
  assert.equal(await removing, 'unavailable');
  release.resolve();
  await nextTurn();
  assert.equal(store.admissions.length, 0);
  assert.equal(await administration.removeMember(actor, request), 'unavailable');
});

test('Given a finalization that committed before a delayed answer, when the deadline is consumed by that answer, then the caller gets unknown without late receipt work', async (t) => {
  const time = removalTime(t);
  const { administration, store } = removalFixture();
  const complete = store.completeRemoval.bind(store);
  store.completeRemoval = async (...arguments_) => {
    const result = await complete(...arguments_);
    time.advance(30_000);
    return result;
  };
  let reads = 0;
  store.readRemoval = async () => { reads++; return { status: 'absent' }; };
  assert.equal(await administration.removeMember(actor, request), 'unknown');
  assert.equal(reads, 0);
  assert.equal(store.operations.get('org-a')?.outcome, 'applied');
});

test('Given all current removal reads, when the operation completes, then they share one server lifetime signal that is aborted after completion', async () => {
  const fixture = removalFixture();
  fixture.directory.pageSize = 100;
  const directory: OrganizationDirectory = fixture.directory;
  const signals: (AbortSignal | undefined)[] = [];
  const memberships = directory.membershipsOf.bind(directory);
  const member = directory.member.bind(directory);
  const page = directory.memberFactsPage.bind(directory);
  directory.membershipsOf = async (user, signal) => { signals.push(signal); return memberships(user); };
  directory.member = async (id, signal) => { signals.push(signal); return member(id); };
  directory.memberFactsPage = async query => { signals.push(query.signal); return page(query); };
  directory.deleteMembership = async () => ({ outcome: 'applied' });
  assert.equal(await fixture.administration.removeMember(actor, request), 'applied');
  assert.equal(signals.length, 4);
  const [signal] = signals;
  assert.ok(signal instanceof AbortSignal);
  assert.ok(signals.every(value => value === signal));
  assert.equal(signal.aborted, true);
});

for (const stop of ['deadline', 'close'] as const) {
  test(`Given a provider read still in flight, when ${stop} ends the removal lifetime, then its signal stops further provider read steps`, async (t) => {
    const time = removalTime(t);
    const fixture = removalFixture();
    const directory: OrganizationDirectory = fixture.directory;
    const release = Promise.withResolvers<void>();
    const reached = Promise.withResolvers<void>();
    t.after(() => release.resolve());
    const member = directory.member.bind(directory);
    let readSignal: AbortSignal | undefined;
    directory.member = async (id, signal) => {
      readSignal = signal;
      reached.resolve();
      await release.promise;
      return member(id);
    };
    const removing = fixture.administration.removeMember(actor, request);
    await reached.promise;
    assert.equal(readSignal?.aborted, false);
    if (stop === 'deadline') time.advance(30_000);
    else await fixture.administration.close();
    assert.equal(await removing, 'unknown');
    assert.equal(readSignal.aborted, true);
    release.resolve();
    await nextTurn();
    assert.deepEqual(fixture.deletes, []);
  });
}
