import { syncBuiltinESMExports } from 'node:module';
import type { TestContext } from 'node:test';

// Use this function after each t.mock.method on a Node built-in module, so that the ESM named exports get the mocks.
// At the end of the test, the function restores all mocks of the test and then syncs the exports again. The test
// runner restores mocks only after the after hooks, so without this restore the sync keeps the mocks.
export function syncBuiltinMocks(t: TestContext): void {
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
}
