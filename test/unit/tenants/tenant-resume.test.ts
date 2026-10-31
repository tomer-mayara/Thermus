import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServiceChange } from '../../../src/tenancy/tenants/tenant-platform.ts';
import { platformResumeOf } from '../../../src/tenancy/tenants/tenant-resume.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

// The resume operation of the gateway on the tenant platform (SO-10): one resume call of the platform for the service
// of the mark, and each answer other than accepted as a failure with a reason that the operator log can hold.

const service = { organizationId: 'org_A', serviceId: 'srv-a' };

test('Given a suspended service, when the gateway resumes it, then the platform gets one resume call for that service, and an accepted call gives resumed', async () => {
  const platform = new TenantPlatformFake();

  assert.deepEqual(await platformResumeOf(platform).resume(service), { status: 'resumed' });
  assert.deepEqual(platform.calls, ['resume srv-a']);
});

for (const [label, change, reason] of [
  ['limits the calls', { status: 'rate-limited', retryAfterMs: 29_500 }, 'the platform limits the calls of the service for 30 s'],
  ['refuses', { status: 'refused', reason: 'The tenant registry does not own the Render service srv-a.' }, 'The tenant registry does not own the Render service srv-a.'],
  ['gives no clear answer', { status: 'unknown', reason: 'Render answered 503: Service Unavailable' }, 'Render answered 503: Service Unavailable'],
  ['no longer has the service', { status: 'gone' }, 'the tenant service no longer exists'],
] as const satisfies ReadonlyArray<readonly [string, ServiceChange, string]>) {
  test(`Given a platform that ${label}, when the gateway resumes a service, then the outcome is failed with the reason`, async () => {
    const platform = new TenantPlatformFake();
    platform.changes.push(change);

    assert.deepEqual(await platformResumeOf(platform).resume(service), { status: 'failed', reason: `The platform did not take the resume: ${reason}` });
    assert.deepEqual(platform.calls, ['resume srv-a']);
  });
}

test('Given a resume call, when it goes to the platform, then its signal is not aborted, because no request or stop of a caller ends a resume that the row already shows', async () => {
  const signals: AbortSignal[] = [];
  const platform = { resumeService: async (_serviceId: string, signal: AbortSignal) => { signals.push(signal); return { status: 'accepted' } as const; } };

  await platformResumeOf(platform).resume(service);

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.aborted, false);
});
