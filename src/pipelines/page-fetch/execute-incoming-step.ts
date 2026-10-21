import type { WebsiteFetchResult } from '../providers/website-fetcher/website-fetcher.ts';
import type { ExecutionContext } from '../execution/execution-context.ts';
import type { FetchPageOutcome } from './fetch-page.ts';
import type { BlockCode, IncomingStep, StepResult } from '../execution/pipeline-step.ts';
import { writeStepRecord, type StepOutcome, type StepRecordSink } from '../execution/step-record.ts';

export async function executeIncomingStep(input: WebsiteFetchResult, execution: ExecutionContext, dependencies: {
  incoming: IncomingStep;
  records: StepRecordSink;
}): Promise<FetchPageOutcome> {
  const { signal, operationId } = execution;
  throwIfCancelled(signal);
  const startedAt = performance.now();
  let outcome: StepOutcome = { outcome: 'failed', code: 'step_failed' };
  try {
    const result = await dependencies.incoming.execute(input, signal);
    throwIfCancelled(signal);
    const checked = checkedResult(result);
    throwIfCancelled(signal);
    if (checked === undefined) outcome = { outcome: 'failed', code: 'invalid_step_result' };
    else if (checked.decision === 'allow') {
      outcome = { outcome: 'allowed' };
      return { status: 'released', markdown: checked.output };
    } else {
      outcome = { outcome: 'blocked', code: checked.code };
      if (checked.code === 'scan_failed' || checked.code === 'scan_limit') return { status: 'withheld', code: checked.code };
    }
    throw new Error('Page processing failed');
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      outcome = { outcome: 'cancelled', code: 'cancelled' };
      throw new DOMException('Request cancelled', 'AbortError');
    }
    throw new Error('Page processing failed');
  } finally {
    writeStepRecord(dependencies.records, { operationId, stepId: 'incoming.process_html', ...outcome }, startedAt);
  }
}

function checkedResult(value: unknown): StepResult<string> | undefined {
  if (!isResultObject(value)) return undefined;
  const { decision, output, code } = value;
  const hasOutput = Object.hasOwn(value, 'output');
  const hasCode = Object.hasOwn(value, 'code');
  if (decision === 'allow' && hasOutput && !hasCode && typeof output === 'string') return { decision, output };
  if (decision === 'block' && hasCode && !hasOutput && isIncomingBlockCode(code)) return { decision, code };
  return undefined;
}

function isIncomingBlockCode(value: unknown): value is BlockCode {
  return value === 'blocked' || value === 'scan_failed' || value === 'scan_limit';
}

function isResultObject(value: unknown): value is { decision?: unknown; output?: unknown; code?: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.hasOwn(value, 'decision');
}

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
}
