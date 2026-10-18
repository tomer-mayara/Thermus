import type { StepId } from './pipeline-step.ts';

export type StepOutcome =
  | { outcome: 'allowed' }
  | { outcome: 'blocked'; code: 'blocked' }
  | { outcome: 'failed'; code: 'step_failed' | 'invalid_step_result' }
  | { outcome: 'cancelled'; code: 'cancelled' };

export type StepRecord = StepOutcome & {
  event: 'pipeline.step.completed';
  operationId: string;
  stepId: StepId;
  durationMs: number;
};

export interface StepRecordSink {
  record(event: StepRecord): void;
}

export function writeStepRecord(sink: StepRecordSink, record: StepOutcome & { operationId: string; stepId: StepId }, startedAt: number): void {
  try {
    sink.record({ event: 'pipeline.step.completed', ...record, durationMs: boundedDuration(startedAt) });
  } catch {
    // Step records are best effort. A failed write must not change the result or repeat work.
  }
}

function boundedDuration(startedAt: number): number {
  const endedAt = performance.now();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(endedAt - startedAt)));
}
