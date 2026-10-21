import type { createFetchPage } from '../../../src/page-fetch/fetch-page.ts';
import type { StepId } from '../../../src/page-fetch/pipeline-step.ts';
import type { StepRecord } from '../../../src/page-fetch/step-record.ts';

type Dependencies = Parameters<typeof createFetchPage>[0];
type OutgoingResult = Awaited<ReturnType<Dependencies['outgoing']['execute']>>;
type IncomingResult = Awaited<ReturnType<Dependencies['incoming']['execute']>>;

// Given the outgoing role, only the general block code is accepted.
export const outgoingAllowed = { decision: 'allow', output: 'https://example.com/' } satisfies OutgoingResult;
export const outgoingBlocked = { decision: 'block', code: 'blocked' } satisfies OutgoingResult;
// @ts-expect-error Outgoing observation cannot report a failed HTML scan.
export const outgoingScanFailed = { decision: 'block', code: 'scan_failed' } satisfies OutgoingResult;
// @ts-expect-error Outgoing observation cannot report an HTML scan limit.
export const outgoingScanLimit = { decision: 'block', code: 'scan_limit' } satisfies OutgoingResult;

// Given the incoming role, release and all existing block codes are accepted.
export const incomingAllowed = { decision: 'allow', output: '' } satisfies IncomingResult;
export const incomingBlocked = { decision: 'block', code: 'blocked' } satisfies IncomingResult;
export const incomingScanFailed = { decision: 'block', code: 'scan_failed' } satisfies IncomingResult;
export const incomingScanLimit = { decision: 'block', code: 'scan_limit' } satisfies IncomingResult;

export const sharedStepIds = [
  'outgoing.observe_request', 'incoming.process_html',
  'search.outgoing.observe_request', 'search.incoming.process_html',
] satisfies StepId[];
export const searchStepRecord = {
  event: 'pipeline.step.completed', operationId: '7aa019ef-760d-477e-8f2f-9df14f614d4d',
  stepId: 'search.outgoing.observe_request', outcome: 'allowed', durationMs: 0,
} satisfies StepRecord;
// @ts-expect-error A provider name is not a stage ID.
export const providerStepId = 'search.brave.fetch' satisfies StepId;
