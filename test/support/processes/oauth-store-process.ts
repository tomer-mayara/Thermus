import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { TestContext } from 'node:test';
import { fetchUrlCredentials } from './module-paths.ts';

const ownerProgram = `
  const { withOAuthStore } = await import(process.argv[1]);
  const profile = JSON.parse(process.argv[2]);
  await withOAuthStore(profile, async store => {
    store.saveReady({accessToken:'old-access',refreshToken:'old-refresh',expiresAt:2000000000000});
    store.markLoginRequired();
    if(process.argv[3]==='temporary') {
      const fs = (await import('node:fs')).default;
      fs.renameSync = () => {
        process.send('locked');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      };
      (await import('node:module')).syncBuiltinESMExports();
      store.saveReady({accessToken:'new-access',refreshToken:'new-refresh',expiresAt:2000000000000});
    }
    if(process.argv[3]==='ready') store.saveReady({accessToken:'new-access',refreshToken:'new-refresh',expiresAt:2000000000000});
    process.send('locked');
    await new Promise(resolve => process.once('message', resolve));
  });
`;

export async function holdOAuthStore(t: TestContext, options: { state: string; profile: Record<string, string>; boundary: 'marker' | 'ready' | 'temporary' }) {
  const { state, profile, boundary } = options;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', ownerProgram, fetchUrlCredentials, JSON.stringify(profile), boundary], {
    env: { PATH: process.env.PATH, XDG_STATE_HOME: state },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  async function stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'close');
    child.kill('SIGKILL');
    await exited;
  }
  t.after(stop);
  let stderr = '';
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
  await Promise.race([
    once(child, 'message'),
    once(child, 'exit').then(() => { throw new Error(`OAuth store owner exited before locking: ${stderr}`); }),
  ]);
  return { stop };
}
