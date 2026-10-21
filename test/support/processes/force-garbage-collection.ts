import assert from 'node:assert/strict';

const collectGarbage = globalThis.gc;
assert.ok(typeof collectGarbage === 'function', 'This preload requires --expose-gc');
setInterval(() => collectGarbage(), 5).unref();
