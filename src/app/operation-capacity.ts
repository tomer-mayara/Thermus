import type { RequestContext } from '../accounts/identity/access-context.ts';
import type { ExecutionContext } from '../pipelines/execution/execution-context.ts';

type Operation<Result> = (input: string, context: RequestContext, execution: ExecutionContext) => Promise<Result>;

export class OperationCapacity {
  private active = false;

  wrap<Result>(operation: Operation<Result>): Operation<Result> {
    return async (input, context, execution) => {
      execution.signal.throwIfAborted();
      if (this.active) throw new Error('Server busy. Try again later.');
      this.active = true;
      try {
        return await operation(input, context, execution);
      } finally {
        this.active = false;
      }
    };
  }
}
