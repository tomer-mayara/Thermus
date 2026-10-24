import type { BlockCode, StepId } from './pipeline-step.ts';
export type StepOutcome = {
    outcome: 'allowed';
} | {
    outcome: 'blocked';
    code: BlockCode;
} | {
    outcome: 'failed';
    code: 'step_failed' | 'invalid_step_result';
} | {
    outcome: 'cancelled';
    code: 'cancelled';
};
export type StepRecord = StepOutcome & {
    event: 'pipeline.step.completed';
    operationId: string;
    stepId: StepId;
    durationMs: number;
};
export interface StepRecordSink {
    record(event: StepRecord): void;
}
export declare function writeStepRecord(sink: StepRecordSink, record: StepOutcome & {
    operationId: string;
    stepId: StepId;
}, startedAt: number): void;
