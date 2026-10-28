import { setTimeout as wait } from 'node:timers/promises';
import type { ProvisioningClock } from '../tenancy/tenants/provisioning-clock.ts';

/** The monotonic clock of the process. A wait rejects when its stop signal aborts, so a close never waits for it. */
export const systemClock: ProvisioningClock = {
  now: () => performance.now(),
  sleep: (ms, signal) => wait(ms, undefined, { signal }),
};
