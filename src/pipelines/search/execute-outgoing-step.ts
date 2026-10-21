import { isSearchCancelled, throwIfSearchCancelled } from './search-cancellation.ts';
import type { ExecutionContext } from '../execution/execution-context.ts';
import type { OutgoingStep, StepResult } from '../execution/pipeline-step.ts';
import { writeStepRecord, type StepOutcome, type StepRecordSink } from '../execution/step-record.ts';

export async function executeOutgoingStep(input: string, execution: ExecutionContext, dependencies: {
  outgoing: OutgoingStep;
  records: StepRecordSink;
}): Promise<string> {
  const { signal, operationId } = execution;
  throwIfSearchCancelled(signal);
  const startedAt = performance.now();
  let outcome: StepOutcome = { outcome: 'failed', code: 'step_failed' };
  try {
    const result = await dependencies.outgoing.execute(input, signal);
    throwIfSearchCancelled(signal);
    const checked = checkedResult(result, input);
    throwIfSearchCancelled(signal);
    if (checked === undefined) outcome = { outcome: 'failed', code: 'invalid_step_result' };
    else if (checked.decision === 'allow') {
      outcome = { outcome: 'allowed' };
      return checked.output;
    } else outcome = { outcome: 'blocked', code: checked.code };
    throw new Error('Search failed');
  } catch (error) {
    if (isSearchCancelled(signal, error)) {
      outcome = { outcome: 'cancelled', code: 'cancelled' };
      throw new DOMException('Request cancelled', 'AbortError');
    }
    throw new Error('Search failed');
  } finally {
    writeStepRecord(dependencies.records, { operationId, stepId: 'search.outgoing.observe_request', ...outcome }, startedAt);
  }
}

function checkedResult(value: unknown, input: string): StepResult<string, 'blocked'> | undefined {
  if (!isResultObject(value)) return undefined;
  const { decision, output, code } = value;
  const hasOutput = Object.hasOwn(value, 'output');
  const hasCode = Object.hasOwn(value, 'code');
  if (decision === 'allow' && hasOutput && !hasCode && output === input) return { decision, output };
  if (decision === 'block' && hasCode && !hasOutput && code === 'blocked') return { decision, code };
  return undefined;
}

function isResultObject(value: unknown): value is { decision?: unknown; output?: unknown; code?: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.hasOwn(value, 'decision');
}
