import type { PipelineStep, StepResult } from './pipeline-step.ts';

export class ObserveRequestStep implements PipelineStep<string, string> {
  readonly id = 'outgoing.observe_request';

  async execute(input: string, _signal: AbortSignal): Promise<StepResult<string>> {
    return { decision: 'allow', output: input };
  }
}
