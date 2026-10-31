import assert from 'node:assert/strict';
import { after, before } from 'node:test';

interface OutboundFetchGuardOptions {
  // Lets a request to 127.0.0.1 through to the real fetch. The default refuses each request.
  readonly allowLoopback?: boolean;
  readonly refusal: string;
  readonly finding: string;
}

export interface OutboundFetchGuard {
  readonly refusedRequests: readonly string[];
  install(): void;
  // Puts the real fetch back, then fails with the finding when a request was refused.
  release(): void;
}

export function outboundFetchGuard({ allowLoopback = false, refusal, finding }: OutboundFetchGuardOptions): OutboundFetchGuard {
  const refusedRequests: string[] = [];
  let realFetch = globalThis.fetch;
  const guardedFetch: typeof fetch = async (input, init) => {
    const address = input instanceof Request ? input.url : String(input);
    if (allowLoopback && new URL(address).hostname === '127.0.0.1') return realFetch(input, init);
    refusedRequests.push(address);
    throw new Error(refusal);
  };
  return {
    refusedRequests,
    install() {
      realFetch = globalThis.fetch;
      globalThis.fetch = guardedFetch;
    },
    release() {
      globalThis.fetch = realFetch;
      assert.deepEqual(refusedRequests, [], finding);
    },
  };
}

// Guards the tests of the enclosing describe block: before() installs, after() releases. Call it in the describe block.
// It gives the record of the refused requests. Thus a test can check the record before the end of the block.
export function guardOutboundFetch(options: OutboundFetchGuardOptions): readonly string[] {
  const guard = outboundFetchGuard(options);
  before(() => guard.install());
  after(() => guard.release());
  return guard.refusedRequests;
}
