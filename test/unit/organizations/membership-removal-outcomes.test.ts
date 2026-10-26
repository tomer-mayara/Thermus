import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrganizationAdministration } from '../../../src/accounts/organizations/organization-administration.ts';
import type { OrganizationDirectory } from '../../../src/accounts/organizations/organization-directory.ts';
import { actor, request, removalFixture } from './fixtures/membership-removal-fixtures.ts';

test('Given an authorization read failure, when removal is requested, then it is unavailable without admission or provider deletion', async () => {
  const { administration, directory, store, deletes } = removalFixture();
  directory.membershipsOf = async () => { throw new Error('Current authority is unavailable'); };
  assert.equal(await administration.removeMember(actor, request), 'unavailable');
  assert.equal(store.admissions.length, 0);
  assert.deepEqual(deletes, []);
});

for (const answer of ['unconfirmed', 'throw'] as const) {
  test(`Given an admission that commits but gives ${answer}, when its own intent is visible, then it still sends nothing and makes no recovery read`, async () => {
    const { administration, store, deletes } = removalFixture();
    const admit = store.admitRemoval.bind(store);
    store.admitRemoval = async (intent) => {
      await admit(intent);
      if (answer === 'throw') throw new Error('Admission answer lost');
      return { status: 'unconfirmed' };
    };
    let reads = 0;
    store.readRemoval = async () => { reads++; throw new Error('No admission recovery is allowed'); };
    assert.equal(await administration.removeMember(actor, request), 'unknown');
    assert.deepEqual(deletes, []);
    assert.equal(reads, 0);
    assert.equal(store.operations.get('org-a')?.outcome, null);
    assert.equal(store.completions.length, 0);
  });
}

test('Given another unresolved operation, when a valid conflicting removal arrives, then it returns busy without target reads, deletion, or completion', async () => {
  const { administration, directory, store, deletes } = removalFixture();
  store.admitRemoval = async () => ({ status: 'busy' });
  let reads = 0;
  directory.member = async () => { reads++; throw new Error('No target read before admission'); };
  assert.equal(await administration.removeMember(actor, request), 'busy');
  assert.equal(reads, 0);
  assert.deepEqual(deletes, []);
  assert.equal(store.completions.length, 0);
});

test('Given removal storage that explicitly refuses availability, when removal is requested, then it sends nothing and leaves ordinary reads usable', async () => {
  const { administration, store, deletes } = removalFixture();
  store.admitRemoval = async () => ({ status: 'unavailable' });
  assert.equal(await administration.removeMember(actor, request), 'unavailable');
  assert.deepEqual(deletes, []);
  assert.equal((await administration.listOrganizations(actor.user)).length, 1);
});

for (const providerEffect of ['absent', 'applied'] as const) {
  test(`Given a thrown provider error with an ${providerEffect} effect, when removal was sent once, then uncertainty holds the organization and prevents a second delete`, async () => {
    const { administration, directory, store, deletes } = removalFixture();
    const remove = directory.deleteMembership.bind(directory);
    let sends = 0;
    directory.deleteMembership = async (id) => {
      sends++;
      if (providerEffect === 'applied') await remove(id);
      throw new Error('Provider result is unknown');
    };
    assert.equal(await administration.removeMember(actor, request), 'unknown');
    assert.equal(store.operations.get('org-a')?.outcome, null);
    assert.equal(store.completions.length, 0);
    assert.equal(await administration.removeMember(actor, { ...request, membershipId: 'member-a' }), 'busy');
    assert.equal(sends, 1);
    assert.equal(deletes.length, providerEffect === 'applied' ? 1 : 0);
  });
}

test('Given an explicit provider no-effect refusal, when deletion is unsupported, then the same operation is durably completed without an effect', async () => {
  const { administration, directory, store } = removalFixture();
  directory.deleteMembership = async () => ({ outcome: 'unsupported' });
  assert.equal(await administration.removeMember(actor, request), 'unsupported');
  assert.equal(store.operations.get('org-a')?.outcome, 'no-effect');
  assert.ok(await directory.member(request.membershipId));
});

for (const result of [undefined, { outcome: 'not-found' }]) {
  test(`Given a provider answer of ${JSON.stringify(result)}, when no terminal result is proved, then removal stays unknown`, async () => {
    const { administration, directory, store } = removalFixture();
    directory.deleteMembership = (async () => result) as OrganizationDirectory['deleteMembership'];
    assert.equal(await administration.removeMember(actor, request), 'unknown');
    assert.equal(store.operations.get('org-a')?.outcome, null);
    assert.equal(store.completions.length, 0);
  });
}

for (const answer of ['unconfirmed', 'unavailable', 'throw'] as const) {
  test(`Given finalization that commits but gives ${answer}, when the exact terminal receipt is read, then the confirmed result can be returned`, async () => {
    const { administration, store } = removalFixture();
    const complete = store.completeRemoval.bind(store);
    store.completeRemoval = async (...arguments_) => {
      await complete(...arguments_);
      if (answer === 'throw') throw new Error('Final commit answer lost');
      return { status: answer };
    };
    assert.equal(await administration.removeMember(actor, request), 'applied');
    assert.equal(store.operations.get('org-a')?.outcome, 'applied');
  });
}

for (const receipt of ['pending', 'absent', 'other-operation', 'other-organization', 'other-outcome', 'unavailable', 'throw'] as const) {
  test(`Given an uncertain final commit with a ${receipt} receipt, when provider deletion succeeded, then no durable success is claimed`, async () => {
    const { administration, store, deletes } = removalFixture();
    store.completeRemoval = async () => ({ status: 'unconfirmed' });
    store.readRemoval = async () => {
      if (receipt === 'throw') throw new Error('Receipt read failed');
      if (receipt === 'absent' || receipt === 'unavailable') return { status: receipt };
      const operation = store.operations.get('org-a');
      assert.ok(operation);
      return { status: 'found', operation: {
        ...operation,
        outcome: receipt === 'pending' ? null : receipt === 'other-outcome' ? 'no-effect' : 'applied',
        operationId: receipt === 'other-operation' ? 'new-operation' : operation.operationId,
        organizationId: receipt === 'other-organization' ? 'org-b' : operation.organizationId,
      } };
    };
    assert.equal(await administration.removeMember(actor, request), 'unknown');
    assert.deepEqual(deletes, [request.membershipId]);
  });
}

test('Given an explicit completion mismatch, when a later read could show matching fields, then the rejected completion still returns unknown', async () => {
  const { administration, store } = removalFixture();
  store.completeRemoval = async () => ({ status: 'mismatch' });
  let reads = 0;
  store.readRemoval = async () => {
    reads++;
    const operation = store.operations.get('org-a');
    assert.ok(operation);
    return { status: 'found', operation: { ...operation, outcome: 'applied' } };
  };
  assert.equal(await administration.removeMember(actor, request), 'unknown');
  assert.equal(reads, 0);
});

test('Given another operation admitted before an old completion, when the stale completion runs, then it cannot clear the new hold', async () => {
  const { administration, directory, store } = removalFixture();
  directory.deleteMembership = async () => {
    const operation = store.operations.get('org-a');
    assert.ok(operation);
    await store.completeRemoval('org-a', operation.operationId, 'applied');
    await store.admitRemoval({ ...operation, operationId: 'replacement-operation' });
    return { outcome: 'applied' };
  };
  assert.equal(await administration.removeMember(actor, request), 'unknown');
  assert.equal(store.operations.get('org-a')?.operationId, 'replacement-operation');
  assert.equal(store.operations.get('org-a')?.outcome, null);
});

for (const outcome of ['applied', 'unknown'] as const) {
  test(`Given a recorder that throws, when removal returns ${outcome}, then recording cannot change the result or repeat deletion`, async () => {
    const { options, directory, store } = removalFixture();
    let sends = 0;
    directory.deleteMembership = async () => {
      sends++;
      if (outcome === 'unknown') throw new Error('Provider answer lost');
      return { outcome: 'applied' };
    };
    const administration = new OrganizationAdministration({ ...options, records: { record: () => { throw new Error('Recorder failed'); } } });
    assert.equal(await administration.removeMember(actor, request), outcome);
    assert.equal(sends, 1);
    assert.equal(store.operations.get('org-a')?.outcome, outcome === 'applied' ? 'applied' : null);
  });
}
