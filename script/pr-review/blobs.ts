import { spawnSync } from 'node:child_process';
import { CommandError } from '../code-quality/shared/command-error.ts';
import { outputLimit } from '../code-quality/shared/subprocess.ts';

// One git cat-file process, because one git show for each source file takes seconds. The shared git helper reads
// text, and this output gives sizes in bytes.
export function blobsAt(root: string, revision: string, paths: readonly string[]): Map<string, string> {
  const listed = paths.filter((path) => !path.includes('\n'));
  if (listed.length === 0) return new Map();
  const input = listed.map((path) => `${revision}:${path}\n`).join('');
  const run = spawnSync('git', ['cat-file', '--batch'], { cwd: root, input, maxBuffer: outputLimit });
  if (run.error || run.status !== 0) {
    const detail = run.error?.message ?? run.stderr.toString('utf8').trim().split('\n')[0];
    throw new CommandError(`git cat-file could not read the files at ${revision}. ${detail}`.trim());
  }
  return blobsOf(run.stdout, listed);
}

// An entry is "<object> <type> <size>", the content, and a new line. A missing object has one line only.
function blobsOf(output: Buffer, paths: readonly string[]): Map<string, string> {
  const blobs = new Map<string, string>();
  let offset = 0;
  for (const path of paths) {
    const end = output.indexOf(10, offset);
    if (end < 0) break;
    const header = /^\S+ (\S+) (\d+)$/u.exec(output.subarray(offset, end).toString('utf8'));
    offset = end + 1;
    if (!header) continue;
    const size = Number(header[2]);
    if (header[1] === 'blob') blobs.set(path, output.subarray(offset, offset + size).toString('utf8'));
    offset += size + 1;
  }
  return blobs;
}
