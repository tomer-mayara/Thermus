export type StepId = 'outgoing.observe_request' | 'incoming.process_html';
export type BlockCode = 'blocked' | 'scan_failed' | 'scan_limit';

export type StepResult<Output> =
  | { decision: 'allow'; output: Output }
  | { decision: 'block'; code: BlockCode };

export interface PipelineStep<Input, Output> {
  readonly id: StepId;
  execute(input: Input, signal: AbortSignal): Promise<StepResult<Output>>;
}
