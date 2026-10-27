import type { RequestContext } from '../accounts/identity/access-context.ts';
import type { ExecutionContext } from '../pipelines/execution/execution-context.ts';

type Operation<Result> = (input: string, context: RequestContext, execution: ExecutionContext) => Promise<Result>;

export class OperationCapacity {
  private active = 0;

  constructor(private readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('The operation capacity must be a whole number of at least 1.');
  }

  wrap<Result>(operation: Operation<Result>): Operation<Result> {
    return async (input, context, execution) => {
      execution.signal.throwIfAborted();
      if (this.active >= this.limit) throw new Error('Server busy. Try again later.');
      this.active += 1;
      try {
        return await operation(input, context, execution);
      } finally {
        this.active -= 1;
      }
    };
  }
}
