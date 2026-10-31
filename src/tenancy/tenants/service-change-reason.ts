import type { ServiceChange } from './tenant-platform.ts';

/** A suspend or resume call that the platform did not take. */
export type ServiceChangeMiss = Exclude<ServiceChange, { readonly status: 'accepted' }>;

/** Why the platform did not take a suspend or resume call, as safe text for the operator log. */
export function serviceChangeReason(change: ServiceChangeMiss): string {
  if (change.status === 'gone') return 'the tenant service no longer exists';
  if (change.status === 'rate-limited') return `the platform limits the calls of the service for ${Math.ceil(change.retryAfterMs / 1_000)} s`;
  return change.reason;
}
