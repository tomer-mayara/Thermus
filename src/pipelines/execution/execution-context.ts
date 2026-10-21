export interface ExecutionContext {
  readonly signal: AbortSignal;
  readonly operationId: string;
}

export function assertOperationId(value: unknown): void {
  if (typeof value !== 'string' || value.length !== 36
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Invalid execution context');
  }
}
