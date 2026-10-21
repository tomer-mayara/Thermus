import { isSearchCancelled, throwIfSearchCancelled } from './search-cancellation.ts';
import type { WebsiteFetchResult } from '../website-fetcher/website-fetcher.ts';
import type { ExecutionContext } from '../page-fetch/execution-context.ts';
import type { SearchOutcome } from './search-pipeline.ts';
import type { BlockCode, IncomingStep, StepResult } from '../page-fetch/pipeline-step.ts';
import { writeStepRecord, type StepOutcome, type StepRecordSink } from '../page-fetch/step-record.ts';

export async function executeIncomingStep(input: WebsiteFetchResult, execution: ExecutionContext, dependencies: {
  incoming: IncomingStep;
  records: StepRecordSink;
}): Promise<SearchOutcome> {
  const { signal, operationId } = execution;
  throwIfSearchCancelled(signal);
  const startedAt = performance.now();
  let outcome: StepOutcome = { outcome: 'failed', code: 'step_failed' };
  try {
    const result = await dependencies.incoming.execute(input, signal);
    throwIfSearchCancelled(signal);
    const checked = checkedResult(result);
    throwIfSearchCancelled(signal);
    if (checked === undefined) outcome = { outcome: 'failed', code: 'invalid_step_result' };
    else if (checked.decision === 'allow') {
      outcome = { outcome: 'allowed' };
      return { status: 'released', markdown: checked.output };
    } else if (checked.decision === 'block') {
      outcome = { outcome: 'blocked', code: checked.code };
      if (checked.code === 'scan_failed' || checked.code === 'scan_limit') return { status: 'withheld', code: checked.code };
    }
    throw new Error('Search processing failed');
  } catch (error) {
    if (isSearchCancelled(signal, error)) {
      outcome = { outcome: 'cancelled', code: 'cancelled' };
      throw new DOMException('Request cancelled', 'AbortError');
    }
    throw new Error('Search processing failed');
  } finally {
    writeStepRecord(dependencies.records, { operationId, stepId: 'search.incoming.process_html', ...outcome }, startedAt);
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
