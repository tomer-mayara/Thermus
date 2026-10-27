#!/usr/bin/env node
// SO-01d part two: the Render private network probe of the self on-boarding plan, Slice 1. In the workspace Thermus
// AI, it creates the private service of SO-01c, thermus-spike-<UTC start time>, and a disposable web service from
// the same image, thermus-spike-web-<UTC start time>. A one-off job on the web service requests /healthz of the
// private service at its internal address, on port 10000 and on port 8080; the log lines of the job are the
// transcript. Then this machine checks that the internal address does not resolve from the public internet. At the
// end, the script deletes both services, also after a failure or a stop signal. Each step of
// private-network-probe/steps.ts asserts one Given-When-Then specification. The job replaces the Render shell of the
// ticket: the check repeats without a person at a keyboard. The probe reuses the Render client, calls, waits, polls,
// and answers of SO-01c (render-tenant-lifecycle/), with its rules: the client refuses each call to a service other
// than the thermus-spike-* services of this run, and always the production service; it reads RENDER_API_KEY from the
// environment, and no output holds the key. docs/implementation/self-onboarding-s1.md (section SO-01d) names the
// documentation page of each call. This is a probe, not production code. Run it from the repository root: --help
// prints the usage.
import { messageOf, progress } from './render-tenant-lifecycle/context.ts';
import { readApiKey, UsageError } from './render-tenant-lifecycle/inputs.ts';
import { RenderClient } from './render-tenant-lifecycle/render-client.ts';
import { cleanupStep } from './private-network-probe/cleanup.ts';
import { newState, type ProbeContext, type ProbeStep } from './private-network-probe/context.ts';
import { renderDryRun } from './private-network-probe/dry-run.ts';
import { parseInputs, USAGE, type ProbeInputs } from './private-network-probe/inputs.ts';
import { renderReport } from './private-network-probe/report.ts';
import { preflightStep, probeSteps } from './private-network-probe/steps.ts';

const CLEANUP_LIMIT_MS = 10 * 60_000;

function runToken(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

async function runStep(step: ProbeStep, context: ProbeContext): Promise<boolean> {
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

async function runSteps(context: ProbeContext): Promise<boolean> {
  const steps = [preflightStep, ...(context.inputs.preflightOnly ? [] : probeSteps.filter((step) => context.inputs.steps.includes(step.id)))];
  for (const [index, step] of steps.entries()) {
    if (await runStep(step, context)) continue;
    const skipped = steps.slice(index + 1).map((later) => later.name);
    if (skipped.length > 0) context.report.conclusions.push(`- NOT RUN ${skipped.join(', ')}: an earlier step failed.`);
    return false;
  }
  return true;
}

function stopOnSignal(controller: AbortController): void {
  const stop = (signal: NodeJS.Signals): void => {
    progress(`${signal}: the probe stops now, and the cleanup runs. A second ${signal} stops it at once and can leave the services.`);
    controller.abort(signal);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

async function runProbe(inputs: ProbeInputs, key: string): Promise<number> {
  const controller = new AbortController();
  const startedAt = new Date();
  const run = runToken(startedAt);
  const context: ProbeContext = {
    inputs, run, client: new RenderClient(key, !inputs.preflightOnly), report: { rows: [], transcript: [], conclusions: [] },
    state: newState(inputs, run), signal: controller.signal, startedAt,
  };
  stopOnSignal(controller);
  const passed = await runSteps(context);
  const keep = inputs.keep && passed;
  const cleaned = inputs.preflightOnly || await runStep(cleanupStep, { ...context, inputs: { ...inputs, keep }, signal: AbortSignal.timeout(CLEANUP_LIMIT_MS) });
  process.stdout.write(renderReport(context));
  progress(`writes in this run: ${context.client.writes.length}; reads: ${context.client.reads}`);
  return passed && cleaned ? 0 : 1;
}

async function main(args: readonly string[]): Promise<number> {
  if (args.includes('--help')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  try {
    const inputs = parseInputs(args);
    if (inputs.dryRun) {
      process.stdout.write(renderDryRun(inputs));
      return 0;
    }
    return await runProbe(inputs, readApiKey(process.env));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`private-network-probe: ${error.message}\n\n${USAGE}\n`);
    return 2;
  }
}

function failIfAHandleKeepsTheProcessAlive(): void {
  setTimeout(() => {
    process.stderr.write('private-network-probe: FAIL the process did not exit within 10 s; a handle is still open\n');
    process.exit(1);
  }, 10_000).unref();
}

process.exitCode = await main(process.argv.slice(2));
failIfAHandleKeepsTheProcessAlive();
