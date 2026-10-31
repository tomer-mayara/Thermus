export interface ResumedService {
  readonly organizationId: string;
  readonly serviceId: string;
}

/** failed: the platform did not take the resume; the reason is safe text for the operator log. */
export type ResumeOutcome = { readonly status: 'resumed' } | { readonly status: 'failed'; readonly reason: string };

/**
 * The resume of the suspended service of a tenant on its platform. The gateway sends one resume through it; SO-10
 * connects it to the Render API. An outcome is never an exception.
 */
export interface TenantResume {
  resume(service: ResumedService): Promise<ResumeOutcome>;
}
