import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { takeCoverage } from 'node:v8';
import { threadId } from 'node:worker_threads';

// Inherited NODE_OPTIONS registers every cooperating Node child before its work.
// Flush explicitly before marking normal shutdown, so killed children stay incomplete.
const folder = process.env.NODE_V8_COVERAGE;
if (folder) {
  const marker = join(folder, `process-${process.pid}-${randomUUID()}.json`);
  writeFileSync(marker, JSON.stringify({ pid: process.pid, threadId, complete: false }));
  process.on('exit', () => {
    takeCoverage();
    writeFileSync(marker, JSON.stringify({ pid: process.pid, threadId, complete: true }));
  });
}
