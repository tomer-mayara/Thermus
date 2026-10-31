import { basename } from 'node:path';
import { messageOf, progress } from './context.ts';
import { UsageError } from './inputs.ts';

export interface RunnableStep<C> {
  readonly name: string;
  readonly spec: string;
  run(context: C): Promise<string>;
}

interface Concluding {
  readonly report: { readonly conclusions: string[] };
}

const PROGRAM = basename(process.argv[1] ?? 'probe.ts', '.ts');
const EXIT_LIMIT_MS = 10_000;

export function runToken(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

export async function runStep<C extends Concluding>(step: RunnableStep<C>, context: C): Promise<boolean> {
  progress(`${step.name}: ${step.spec}`);
  try {
    context.report.conclusions.push(`- PASS ${step.name}: ${await step.run(context)}`);
    return true;
  } catch (error) {
    context.report.conclusions.push(`- FAIL ${step.name}: ${messageOf(error)}`);
    progress(`FAIL ${step.name}: ${messageOf(error)}`);
    return false;
  }
}

export async function runInOrder<C extends Concluding>(steps: readonly RunnableStep<C>[], context: C): Promise<boolean> {
  for (const [index, step] of steps.entries()) {
    if (await runStep(step, context)) continue;
    const skipped = steps.slice(index + 1).map((later) => later.name);
    if (skipped.length > 0) context.report.conclusions.push(`- NOT RUN ${skipped.join(', ')}: an earlier step failed.`);
    return false;
  }
  return true;
}

// The first signal aborts the run, so that its cleanup runs; the default action of a second one stops the process.
export function stopOnSignal(controller: AbortController, leftOver: string): void {
  const stop = (signal: NodeJS.Signals): void => {
    progress(`${signal}: the probe stops now, and the cleanup runs. A second ${signal} stops it at once and can leave ${leftOver}.`);
    controller.abort(signal);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

// --help gives exit code 0 and a usage error exit code 2; the work gives each other exit code.
export async function runCommand(args: readonly string[], usage: string, work: () => Promise<number>): Promise<number> {
  if (args.includes('--help')) {
    process.stdout.write(`${usage}\n`);
    return 0;
  }
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`${PROGRAM}: ${error.message}\n\n${usage}\n`);
    return 2;
  }
}

export function failIfAHandleKeepsTheProcessAlive(): void {
  setTimeout(() => {
    process.stderr.write(`${PROGRAM}: FAIL the process did not exit within 10 s; a handle is still open\n`);
    process.exit(1);
  }, EXIT_LIMIT_MS).unref();
}
