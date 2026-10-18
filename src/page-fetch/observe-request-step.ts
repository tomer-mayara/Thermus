import type { OutgoingStep, StepResult } from './pipeline-step.ts';

export class ObserveRequestStep implements OutgoingStep {
  async execute(input: string, _signal: AbortSignal): Promise<StepResult<string, 'blocked'>> {
    return { decision: 'allow', output: input };
  }
}
