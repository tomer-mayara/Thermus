import { execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';

const runCommand = promisify(execFile);
const setupGuide = 'See docs/lightpanda-runtime.md.';

export async function pinnedRenderer(): Promise<string> {
  const executable = process.env.LIGHTPANDA_BIN;
  if (executable === undefined || executable === '') {
    throw new Error(`Renderer gate setup failed: set LIGHTPANDA_BIN to the absolute path of the pinned Lightpanda 1.0.0 executable. ${setupGuide}`);
  }
  if (!isAbsolute(executable)) throw new Error(`Renderer gate setup failed: LIGHTPANDA_BIN must be an absolute path. ${setupGuide}`);
  let version: string;
  try {
    version = (await runCommand(executable, ['version'], { timeout: 10_000 })).stdout.trim();
  } catch (cause) {
    throw new Error(`Renderer gate setup failed: the LIGHTPANDA_BIN executable does not run. ${setupGuide}`, { cause });
  }
  if (version !== '1.0.0') throw new Error(`Renderer gate setup failed: LIGHTPANDA_BIN reports Lightpanda ${version}; the gate supports only 1.0.0. ${setupGuide}`);
  return executable;
}
