export type StepId = 'outgoing.observe_request';

export type StepResult<Output> =
  | { decision: 'allow'; output: Output }
  | { decision: 'block'; code: 'blocked' };

export interface PipelineStep<Input, Output> {
  readonly id: StepId;
  execute(input: Input, signal: AbortSignal): Promise<StepResult<Output>>;
}
