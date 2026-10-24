import { type RequestContext } from '../../accounts/identity/access-context.ts';
import type { SearchEngine } from '../providers/search-engine/search-engine.ts';
import { type ExecutionContext } from '../execution/execution-context.ts';
import type { IncomingStep, OutgoingStep } from '../execution/pipeline-step.ts';
import { type RendererFailureReports } from '../providers/website-fetcher/renderer-failure-reports.ts';
import type { StepRecordSink } from '../execution/step-record.ts';
export type SearchOutcome = {
    status: 'released';
    markdown: string;
} | {
    status: 'withheld';
    code: 'scan_failed' | 'scan_limit';
};
interface SearchDependencies extends RendererFailureReports {
    engine: SearchEngine;
    outgoing: OutgoingStep;
    incoming: IncomingStep;
    records: StepRecordSink;
}
export declare class SearchPipeline {
    #private;
    constructor(dependencies: SearchDependencies);
    search(query: string, context: RequestContext, execution: ExecutionContext): Promise<SearchOutcome>;
    private searchDocument;
}
export {};
