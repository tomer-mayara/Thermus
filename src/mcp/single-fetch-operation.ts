import type { FetchOperation } from './get-url-as-markdown.ts';

// Each hosted application shares one slot. Abort does not release it: the operation must finish its cleanup first.
export function singleFetchOperation(operation: FetchOperation): FetchOperation {
  let active = false;
  return async (url, context, execution) => {
    execution.signal.throwIfAborted();
    if (active) throw new Error('Server busy. Try again later.');
    active = true;
    try {
      return await operation(url, context, execution);
    } finally {
      active = false;
    }
  };
}
