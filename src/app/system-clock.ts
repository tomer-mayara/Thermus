import { setTimeout as wait } from 'node:timers/promises';
import type { ProvisioningClock } from '../tenancy/tenants/provisioning-clock.ts';
import type { SweepClock } from '../tenancy/tenants/tenant-sweeps.ts';

export const systemClock: ProvisioningClock = {
  now: () => performance.now(),
  sleep: (ms, signal) => wait(ms, undefined, { signal }),
};

/** The wall clock of the process, in milliseconds since the epoch: the daily tick of the sweeps is at an hour in UTC. */
export const wallClock: SweepClock = {
  now: () => Date.now(),
  sleep: systemClock.sleep,
};
