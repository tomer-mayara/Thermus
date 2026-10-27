#!/usr/bin/env node
// SO-01c: the Render private service lifecycle probe of the self on-boarding plan, Slice 1. In the workspace Thermus
// AI, it creates one image-backed private service named thermus-spike-<UTC start time>, reads its internal address,
// deploys a second image, changes the plan to 1c-2g and back, suspends and resumes it, and deletes it, also after a
// failure or a stop signal. Each step of render-tenant-lifecycle/steps.ts asserts one Given-When-Then
// specification. The calls are in render-tenant-lifecycle/calls.ts; they become the Render adapter of SO-06, and
// docs/implementation/self-onboarding-s1.md (section SO-01c) names the documentation page of each one.
// Rules: the client refuses each call to a service other than the thermus-spike-* service of this run, and always the
// production service. It reads RENDER_API_KEY from the environment, and no output holds the key. The variable values
// are placeholders that pass the hosted startup checks. Only reads and the delete are repeated, and every wait has a
// fixed bound. --preflight makes reads only; --service-id, --steps, and --keep let a developer run the later steps
// one at a time. At the end, the script prints a Markdown report: the steps, each write with its duration and
// rate-limit headers, the answer fields that the provisioner needs, and one conclusion for each step. This is a
// probe, not production code. Run it from the repository root: --help prints the usage.
import { cleanupStep } from './render-tenant-lifecycle/cleanup.ts';
import { SERVICE_PREFIX } from './render-tenant-lifecycle/calls.ts';
import { messageOf, progress, type ProbeContext, type ProbeStep } from './render-tenant-lifecycle/context.ts';
import { DRY_RUN_NAME, renderDryRun } from './render-tenant-lifecycle/dry-run.ts';
import { parseInputs, readApiKey, USAGE, UsageError, type ProbeInputs } from './render-tenant-lifecycle/inputs.ts';
import { RenderClient } from './render-tenant-lifecycle/render-client.ts';
import { renderReport } from './render-tenant-lifecycle/report.ts';
import { lifecycleSteps, preflightStep } from './render-tenant-lifecycle/steps.ts';

const CLEANUP_LIMIT_MS = 10 * 60_000;

function serviceName(now: Date): string {
  return `${SERVICE_PREFIX}${now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}`;
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
  const steps = [preflightStep, ...(context.inputs.preflightOnly ? [] : lifecycleSteps.filter((step) => context.inputs.steps.includes(step.id)))];
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
    progress(`${signal}: the probe stops now, and the cleanup runs. A second ${signal} stops it at once and can leave the service.`);
    controller.abort(signal);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

async function runProbe(inputs: ProbeInputs, key: string): Promise<number> {
  const controller = new AbortController();
  const startedAt = new Date();
  const context: ProbeContext = {
    inputs, name: serviceName(startedAt), client: new RenderClient(key, !inputs.preflightOnly), report: { rows: [], fields: [], conclusions: [] },
    state: { createSent: false }, signal: controller.signal, startedAt,
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
      process.stdout.write(renderDryRun(inputs, DRY_RUN_NAME));
      return 0;
    }
    return await runProbe(inputs, readApiKey(process.env));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`render-tenant-lifecycle: ${error.message}\n\n${USAGE}\n`);
    return 2;
  }
}

function failIfAHandleKeepsTheProcessAlive(): void {
  setTimeout(() => {
    process.stderr.write('render-tenant-lifecycle: FAIL the process did not exit within 10 s; a handle is still open\n');
    process.exit(1);
  }, 10_000).unref();
}

process.exitCode = await main(process.argv.slice(2));
failIfAHandleKeepsTheProcessAlive();
