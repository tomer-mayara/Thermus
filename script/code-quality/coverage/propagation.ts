import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import workerThreads, { type Worker } from 'node:worker_threads';
import { observeSignalExit } from './signal-observations.ts';

const activeWorkers = new Set<Worker>();

export function hasActiveCaptureWorkers(): boolean {
  return activeWorkers.size > 0;
}

// Node forwards coverage into sanitized child environments, but drops preloads.
// Restore only this capture's preload; explicit independent captures stay independent.
export function propagateCapture(lifecycle: string, folder: string): void {
  const preload = `--import=${lifecycle}`;
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) {
    const wrapped = propagatedFunction(childProcess[name], { preload, folder });
    Object.defineProperty(childProcess, name, { ...Object.getOwnPropertyDescriptor(childProcess, name), value: wrapped });
  }
  // CommonJS eval workers do not run --import preloads.
  propagateWorkers({ preload: `--require=${fileURLToPath(lifecycle)}`, folder });
  syncBuiltinESMExports();
}

type Capture = { readonly preload: string; readonly folder: string };
type Options = { readonly env?: NodeJS.ProcessEnv; readonly execArgv?: readonly string[] };

function propagatedFunction(original: (...args: never[]) => unknown, capture: Capture) {
  const wrapped = function (this: unknown, ...args: unknown[]) {
    const changed = propagatedArguments(args, capture);
    try {
      const result = Reflect.apply(original, this, changed);
      if (changed !== args) observeSignalExit(result, capture.folder);
      return result;
    } catch (error) {
      if (changed !== args) observeSignalExit(error, capture.folder);
      throw error;
    }
  };
  for (const key of Reflect.ownKeys(original)) {
    const descriptor = Object.getOwnPropertyDescriptor(original, key);
    if (descriptor === undefined) continue;
    if (key === promisify.custom && typeof descriptor.value === 'function') {
      descriptor.value = descriptor.value === original ? wrapped : propagatedFunction(descriptor.value, capture);
    }
    Object.defineProperty(wrapped, key, descriptor);
  }
  return wrapped;
}

function propagatedArguments(args: unknown[], capture: Capture): unknown[] {
  const index = optionsIndexOf(args);
  const current = args[index];
  if (current !== undefined && current !== null && typeof current !== 'object' && typeof current !== 'function') return args;
  const options = (typeof current === 'function' ? undefined : current) as Options | undefined;
  const env = captureEnvironmentOf(options, capture.folder);
  if (env === undefined) return args;
  const propagated = { ...options, env: { ...env, NODE_OPTIONS: [env.NODE_OPTIONS, capture.preload].filter(Boolean).join(' ') } };
  const changed = [...args];
  if (typeof current === 'function') changed.splice(index, 0, propagated);
  else changed[index] = propagated;
  return changed;
}

function optionsIndexOf(args: readonly unknown[]): number {
  const found = args.findIndex((value, index) => index > 0 && value !== null && typeof value === 'object' && !Array.isArray(value));
  return found < 0 ? (Array.isArray(args[1]) ? 2 : 1) : found;
}

function captureEnvironmentOf(options: Options | undefined, folder: string): NodeJS.ProcessEnv | undefined {
  const env = options?.env ?? process.env;
  const effective = Object.hasOwn(env, 'NODE_V8_COVERAGE') ? env.NODE_V8_COVERAGE : process.env.NODE_V8_COVERAGE;
  return effective === folder ? env : undefined;
}

function propagateWorkers(capture: Capture): void {
  const wrapped = new Proxy(workerThreads.Worker, {
    construct(target, args, constructor) {
      const options = args[1] as workerThreads.WorkerOptions | undefined;
      const env = options?.env === workerThreads.SHARE_ENV ? process.env : options?.env ?? process.env;
      // Node filters inherited flags that are invalid in explicit Worker arguments.
      const changed = env.NODE_V8_COVERAGE === capture.folder && options?.execArgv !== undefined
        ? [args[0], { ...options, execArgv: [...options.execArgv, capture.preload] }]
        : args;
      const worker = Reflect.construct(target, changed, constructor) as Worker;
      activeWorkers.add(worker);
      worker.once('exit', () => activeWorkers.delete(worker));
      return worker;
    },
  });
  Object.defineProperty(workerThreads, 'Worker', { ...Object.getOwnPropertyDescriptor(workerThreads, 'Worker'), value: wrapped });
}
