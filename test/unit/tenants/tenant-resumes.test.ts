import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TenantResumes } from '../../../src/tenancy/tenants/tenant-resumes.ts';
import { TenantRegistryFake } from '../../support/doubles/tenants/tenant-registry-fake.ts';
import { TenantResumeSpy } from '../../support/doubles/tenants/tenant-resume-spy.ts';

function suspendedRegistry(): TenantRegistryFake {
  const registry = new TenantRegistryFake();
  registry.set('org_A', { state: 'suspended', serviceId: 'srv-a' });
  return registry;
}

test('Given a suspended row, when its tenant is resumed, then the row moves to deploying before one resume call with its service ID', async () => {
  const registry = suspendedRegistry();
  const operation = new TenantResumeSpy();
  const statesAtCall: unknown[] = [];
  const resume = operation.resume.bind(operation);
  operation.resume = async (service) => { statesAtCall.push(registry.stateOf(service.organizationId)); return resume(service); };

  const result = await new TenantResumes(registry, operation).resume('org_A');

  assert.deepEqual(result, { status: 'sent' });
  assert.deepEqual(operation.calls, [{ organizationId: 'org_A', serviceId: 'srv-a' }]);
  assert.deepEqual(statesAtCall, ['deploying']);
  assert.equal(registry.stateOf('org_A'), 'deploying');
});

test('Given a resume that runs, when more calls for the organization arrive, then they get pending at once and the platform gets one resume call', async () => {
  const registry = suspendedRegistry();
  const operation = new TenantResumeSpy();
  const held = operation.hold();
  const resumes = new TenantResumes(registry, operation);

  const first = resumes.resume('org_A');
  await operation.untilCalls(1);
  const concurrent = await Promise.all([resumes.resume('org_A'), resumes.resume('org_A')]);
  held.release();

  assert.deepEqual(concurrent, [{ status: 'pending' }, { status: 'pending' }]);
  assert.deepEqual(await first, { status: 'sent' });
  assert.deepEqual(await resumes.resume('org_A'), { status: 'pending' });
  assert.equal(operation.calls.length, 1);
});

test('Given a row that another call or process moved, or no row, when the tenant is resumed, then the result is pending and no resume call goes', async () => {
  const registry = new TenantRegistryFake();
  registry.set('org_A', { state: 'deploying', serviceId: 'srv-a' });
  const operation = new TenantResumeSpy();
  const resumes = new TenantResumes(registry, operation);

  assert.deepEqual(await resumes.resume('org_A'), { status: 'pending' });
  assert.deepEqual(await resumes.resume('org_NONE'), { status: 'pending' });
  assert.deepEqual(operation.calls, []);
});

test('Given a registry that cannot be written, when the tenant is resumed, then the result is unavailable and no resume call goes', async () => {
  const operation = new TenantResumeSpy();
  const store = { markResuming: async () => ({ status: 'unavailable' as const }), restoreSuspended: async () => ({ status: 'unavailable' as const }) };

  assert.deepEqual(await new TenantResumes(store, operation).resume('org_A'), { status: 'unavailable' });
  assert.deepEqual(operation.calls, []);
});

test('Given a resume call that fails, when the tenant is resumed, then the row is suspended again with the reason in the result, and the next call resumes again', async () => {
  const registry = suspendedRegistry();
  const operation = new TenantResumeSpy();
  operation.outcome = { status: 'failed', reason: 'Render answered 429' };
  const resumes = new TenantResumes(registry, operation);

  const failed = await resumes.resume('org_A');
  const stateAfterFailure = registry.stateOf('org_A');
  operation.outcome = { status: 'resumed' };
  const retried = await resumes.resume('org_A');

  assert.deepEqual(failed, { status: 'failed', reason: 'Render answered 429' });
  assert.equal(stateAfterFailure, 'suspended');
  assert.deepEqual(retried, { status: 'sent' });
  assert.equal(operation.calls.length, 2);
});

test('Given a resume operation that throws, when the tenant is resumed, then the result is failed with a fixed reason and the row is suspended again', async () => {
  const registry = suspendedRegistry();
  const operation = { resume: async (): Promise<never> => { throw new Error('private detail of the platform'); } };

  const result = await new TenantResumes(registry, operation).resume('org_A');

  assert.deepEqual(result, { status: 'failed', reason: 'The resume call failed unexpectedly.' });
  assert.equal(registry.stateOf('org_A'), 'suspended');
});
