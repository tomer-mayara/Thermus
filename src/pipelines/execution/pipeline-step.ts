import type { WebsiteFetchResult } from '../providers/website-fetcher/website-fetcher.ts';

export type StepId =
  | 'outgoing.observe_request'
  | 'incoming.process_html'
  | 'search.outgoing.observe_request'
  | 'search.incoming.process_html';
export type BlockCode = 'blocked' | 'scan_failed' | 'scan_limit';

export type StepResult<Output, Code extends BlockCode = BlockCode> =
  | { decision: 'allow'; output: Output }
  | { decision: 'block'; code: Code };

export interface PipelineStep<Input, Output, Code extends BlockCode = BlockCode> {
  execute(input: Input, signal: AbortSignal): Promise<StepResult<Output, Code>>;
}

export type OutgoingStep = PipelineStep<string, string, 'blocked'>;
export type IncomingStep = PipelineStep<WebsiteFetchResult, string>;
