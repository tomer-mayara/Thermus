import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { workSliceStopSignal } from './stop-signal.ts';

const mode = process.argv[2];
const signal = process.argv[3] === 'SIGTERM' ? 'SIGTERM' : 'SIGINT';

async function sliceProcess(): Promise<void> {
  using stopped = workSliceStopSignal(process);
  await using owned = new AsyncDisposableStack();
  const keepAlive = setInterval(() => {}, 1000);
  owned.defer(() => clearInterval(keepAlive));
  owned.defer(async () => {
    process.stdout.write('CLEANUP\n');
    await delay(300);
    process.stdout.write('FLUSHED\n');
  });
  process.stdout.write(`READY ${process.version}\n`);
  process.stdout.write(`Stopping after ${await stopped.received}\n`);
}

async function outerProcess(): Promise<void> {
  const probe = fileURLToPath(import.meta.url);
  const child = spawn('pnpm', ['exec', 'node', '--import', 'tsx', probe, 'slice', signal], { stdio: ['ignore', 'pipe', 'pipe'] });
  let pendingSignal: NodeJS.Signals | undefined;
  let cleanupStarted = false;
  let forwarded = false;
  const forward = (): void => {
    if (!forwarded && pendingSignal !== undefined && cleanupStarted) {
      forwarded = true;
      const received = pendingSignal;
      setTimeout(() => {
        process.stdout.write(`FORWARDED ${received}\n`);
        child.kill(received);
      }, 20);
    }
  };
  const receive = (received: NodeJS.Signals): void => { pendingSignal ??= received; forward(); };
  process.on('SIGINT', receive);
  process.on('SIGTERM', receive);
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    process.stdout.write(chunk);
    cleanupStarted ||= chunk.includes('CLEANUP');
    forward();
  });
  child.stderr.pipe(process.stderr);
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, stoppedBy) => {
      process.stdout.write(`OUTER ${code} ${stoppedBy}\n`);
      process.exitCode = code ?? 1;
      resolve();
    });
  });
  process.off('SIGINT', receive);
  process.off('SIGTERM', receive);
}

if (mode === 'outer') await outerProcess();
else if (mode === 'slice') await sliceProcess();
else throw new Error('Use outer or slice mode.');
