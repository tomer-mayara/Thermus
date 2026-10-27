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
import { progress, type ProbeContext } from './render-tenant-lifecycle/context.ts';
import { DRY_RUN_NAME, renderDryRun } from './render-tenant-lifecycle/dry-run.ts';
import { parseInputs, readApiKey, USAGE, type ProbeInputs } from './render-tenant-lifecycle/inputs.ts';
import { RenderClient } from './render-tenant-lifecycle/render-client.ts';
import { renderReport } from './render-tenant-lifecycle/report.ts';
import { failIfAHandleKeepsTheProcessAlive, runCommand, runInOrder, runStep, runToken, stopOnSignal } from './render-tenant-lifecycle/runner.ts';
import { lifecycleSteps, preflightStep } from './render-tenant-lifecycle/steps.ts';

const CLEANUP_LIMIT_MS = 10 * 60_000;

function runSteps(context: ProbeContext): Promise<boolean> {
  const later = context.inputs.preflightOnly ? [] : lifecycleSteps.filter((step) => context.inputs.steps.includes(step.id));
  return runInOrder([preflightStep, ...later], context);
}

async function runProbe(inputs: ProbeInputs, key: string): Promise<number> {
  const controller = new AbortController();
  const startedAt = new Date();
  const context: ProbeContext = {
    inputs, name: `${SERVICE_PREFIX}${runToken(startedAt)}`, client: new RenderClient(key, !inputs.preflightOnly), report: { rows: [], fields: [], conclusions: [] },
    state: { createSent: false }, signal: controller.signal, startedAt,
  };
  stopOnSignal(controller, 'the service');
  const passed = await runSteps(context);
  const keep = inputs.keep && passed;
  const cleaned = inputs.preflightOnly || await runStep(cleanupStep, { ...context, inputs: { ...inputs, keep }, signal: AbortSignal.timeout(CLEANUP_LIMIT_MS) });
  process.stdout.write(renderReport(context));
  progress(`writes in this run: ${context.client.writes.length}; reads: ${context.client.reads}`);
  return passed && cleaned ? 0 : 1;
}

const args = process.argv.slice(2);
process.exitCode = await runCommand(args, USAGE, async () => {
  const inputs = parseInputs(args);
  if (!inputs.dryRun) return runProbe(inputs, readApiKey(process.env));
  process.stdout.write(renderDryRun(inputs, DRY_RUN_NAME));
  return 0;
});
failIfAHandleKeepsTheProcessAlive();
