import { execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';

const setupGuide = 'See docs/lightpanda-runtime.md.';

// Startup owns this child until it exits. SIGKILL also bounds a child that ignores SIGTERM.
export async function assertHostedRenderer(executable?: string): Promise<void> {
  if (executable === undefined || !isAbsolute(executable)) {
    throw new Error(`Hosted renderer setup failed: LIGHTPANDA_BIN must name an absolute path to Lightpanda 1.0.0. ${setupGuide}`);
  }
  const version = await new Promise<string>((resolve, reject) => {
    execFile(executable, ['version'], {
      timeout: 5_000,
      maxBuffer: 1_024,
      killSignal: 'SIGKILL',
      env: { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: 'true' },
    }, (error, stdout) => {
      if (error !== null) reject(error);
      else resolve(stdout.trim());
    });
  }).catch(() => {
    throw new Error(`Hosted renderer setup failed: LIGHTPANDA_BIN did not complete its bounded version check. ${setupGuide}`);
  });
  if (version !== '1.0.0') {
    throw new Error(`Hosted renderer setup failed: LIGHTPANDA_BIN must report Lightpanda 1.0.0. ${setupGuide}`);
  }
}
