import { type RequestContext } from '../../accounts/identity/access-context.ts';
import { type WebsiteFetcher } from '../providers/website-fetcher/website-fetcher.ts';
import { type ExecutionContext } from '../execution/execution-context.ts';
import { type RendererFailureReports } from '../providers/website-fetcher/renderer-failure-reports.ts';
import type { OutgoingStep, IncomingStep } from '../execution/pipeline-step.ts';
import type { StepRecordSink } from '../execution/step-record.ts';
export type FetchPageOutcome = {
    status: 'released';
    markdown: string;
} | {
    status: 'withheld';
    code: 'scan_failed' | 'scan_limit';
};
export type FetchPage = (url: string, context: RequestContext, execution: ExecutionContext) => Promise<FetchPageOutcome>;
export declare function createFetchPage(dependencies: RendererFailureReports & {
    fetcher: WebsiteFetcher;
    incoming: IncomingStep;
    outgoing: OutgoingStep;
    records: StepRecordSink;
}): FetchPage;
