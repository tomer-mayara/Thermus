import { appendFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// Loaded with --import before a command. When THERMUS_TEST_SQL_TRACE names a file, each SQL statement
// and the stack frame that issued it go to that file, so a test can see which code sends SQL.
const traceFile = process.env.THERMUS_TEST_SQL_TRACE;

type SqlMethod = (this: DatabaseSync, sql: string, ...rest: unknown[]) => unknown;

function issuingFrame(): string {
  const frames = (new Error().stack ?? '').split('\n').slice(1).map((frame) => frame.trim());
  return frames.find((frame) => !frame.includes('trace-sqlite')) ?? '';
}

if (traceFile !== undefined && traceFile !== '') {
  for (const name of ['exec', 'prepare'] as const) {
    const original = DatabaseSync.prototype[name] as SqlMethod;
    const traced: SqlMethod = function traced(this: DatabaseSync, sql, ...rest) {
      appendFileSync(traceFile, `${JSON.stringify({ sql, frame: issuingFrame() })}\n`);
      return original.call(this, sql, ...rest);
    };
    Object.defineProperty(DatabaseSync.prototype, name, { value: traced, writable: true, configurable: true });
  }
}
