import { randomUUID } from 'node:crypto';
import type { ExecutionContext } from '../../../src/pipelines/execution/execution-context.ts';

export const generatedOperationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function executionContextOf(signal: AbortSignal = new AbortController().signal): ExecutionContext {
  return { signal, operationId: randomUUID() };
}
