import { createHash } from 'node:crypto';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CommandError } from '../shared/command-error.ts';
import { pinnedToolVersion } from '../shared/tool-runtime.ts';
import { withAstMetricsServer } from '../mcp/session.ts';

const fixtureSource = 'function atZero(value: number) { return value > 0 ? value : 0; }\n// 😀 café\nclass Callbacks { run(values: number[], read = () => true ? 1 : 0) { return values.map((value) => value > 0 ? value : 0).filter((value) => value !== 0); } }\nconst nested = () => () => true ? 1 : 0;\n';

// A version label alone cannot prove that the whole-tool patch reached the binary.
export async function verifyNativeRuntime(binary: string, workspace: string): Promise<void> {
  const folder = join(workspace, 'smoke');
  mkdirSync(folder);
  writeFileSync(join(folder, 'fixture.ts'), fixtureSource);
  await withAstMetricsServer({ root: realpathSync(folder), folder: '.', checked: { actual: pinnedToolVersion, allowToolVersion: false } }, 60_000, async (server) => {
    const result = JSON.parse(await server.tool('get_file_metrics', { path: 'fixture.ts' }));
    const bytes = Buffer.from(fixtureSource);
    if (result.source_sha256 !== createHash('sha256').update(bytes).digest('hex') || !Array.isArray(result.functions) || result.functions.length !== 7) {
      throw new CommandError('The built runtime failed its source hash and callback inventory check.');
    }
    const starts = new Set<number>();
    const ranges = new Set<string>();
    const paths: number[] = [];
    for (const fn of result.functions) {
      const range = fn.source_range;
      if (range?.coordinates !== 'utf8-bytes' || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end)
        || range.start < 0 || range.end <= range.start || range.end > bytes.length) {
        throw new CommandError('The built runtime failed its declaration byte-range check.');
      }
      starts.add(range.start);
      ranges.add(`${range.start}:${range.end}`);
      paths.push(fn.cyclomatic_complexity);
    }
    const innerStart = bytes.indexOf('() => true ? 1 : 0', bytes.indexOf('const nested'));
    if (ranges.size !== 7 || !starts.has(0) || !starts.has(bytes.indexOf('run(')) || !starts.has(innerStart)
      || paths.sort((a, b) => a - b).join(',') !== '1,1,1,2,2,2,2') {
      throw new CommandError('The built runtime failed its Unicode ranges and own-complexity check.');
    }
  }, binary);
}
