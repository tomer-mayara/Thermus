import { serviceChangeReason } from './service-change-reason.ts';
import type { TenantPlatform } from './tenant-platform.ts';

export interface ResumedService {
  readonly organizationId: string;
  readonly serviceId: string;
}

/** failed: the platform did not take the resume; the reason is safe text for the operator log. */
export type ResumeOutcome = { readonly status: 'resumed' } | { readonly status: 'failed'; readonly reason: string };

/**
 * The resume of the suspended service of a tenant on its platform. The gateway sends one resume through it, and app
 * connects it to the tenant platform with platformResumeOf. An outcome is never an exception.
 */
export interface TenantResume {
  resume(service: ResumedService): Promise<ResumeOutcome>;
}

// No request and no stop of a caller ends a resume call: the row shows deploying before the call, and a call that
// stopped half way would leave the row without its resume. The platform adapter bounds each call in time.
const NO_STOP = new AbortController().signal;

/**
 * The resume operation on the tenant platform (SO-10): one resume call of the service. Each answer other than accepted,
 * also a 429, is a failure with its reason, so the gateway sets the row back to suspended and the next call tries again
 * (answer 4 of 27 October 2026).
 */
export function platformResumeOf(platform: Pick<TenantPlatform, 'resumeService'>): TenantResume {
  return {
    resume: async ({ serviceId }) => {
      const change = await platform.resumeService(serviceId, NO_STOP);
      return change.status === 'accepted' ? { status: 'resumed' } : { status: 'failed', reason: `The platform did not take the resume: ${serviceChangeReason(change)}` };
    },
  };
}
