#!/usr/bin/env node
// SO-01e: the capacity and memory probe of the self on-boarding plan, Slice 1. In the workspace Thermus AI, it makes
// (or reuses with --service-id and --pages-id) a tenant web service from the hosted image, thermus-spike-cap-<UTC start
// time>, on 0.5c-512mb with the WorkOS Staging settings and OPERATION_CAPACITY=10, and a pages origin,
// thermus-spike-pages-<UTC start time>, that serves the controlled pages of the RHD-05 protocol. It registers the
// tenant resource in WorkOS Staging, makes the hosted-live fixtures, and gets a Connect token in a headless browser.
// Then it sends 1, 5, and 10 MCP calls at the same time for the 9 MiB page, the JavaScript page, and the search, and
// reads the Render memory, CPU, and events of each window; it changes the plan to 1c-2g and repeats. At the end it
// deletes what the run made, also after a failure or a stop signal. Each step of capacity-probe/steps.ts asserts one
// Given-When-Then specification. The probe reuses the Render modules of SO-01c and SO-01d part two with their rules:
// the client refuses each call to a service other than the thermus-spike-* services of the run, and always the
// production service. Keys come only from the environment, and no output holds a key or a token.
// docs/implementation/self-onboarding-s1.md (section SO-01e) names the documentation page of each call. This is a
// probe, not production code. Run it from the repository root: --help prints the usage.
import { progress } from './render-tenant-lifecycle/context.ts';
import { RenderClient } from './render-tenant-lifecycle/render-client.ts';
import { failIfAHandleKeepsTheProcessAlive, runCommand, runInOrder, runStep, runToken, stopOnSignal } from './render-tenant-lifecycle/runner.ts';
import { cleanupStep } from './capacity-probe/cleanup.ts';
import { newReport, newState, type ProbeContext } from './capacity-probe/context.ts';
import { renderDryRun } from './capacity-probe/dry-run.ts';
import { parseInputs, USAGE, type ProbeInputs } from './capacity-probe/inputs.ts';
import { renderReport } from './capacity-probe/report.ts';
import { readSecrets, type ProbeSecrets } from './capacity-probe/secrets.ts';
import { preflightStep, probeSteps } from './capacity-probe/steps.ts';

const CLEANUP_LIMIT_MS = 10 * 60_000;

function runSteps(context: ProbeContext): Promise<boolean> {
  const later = context.inputs.preflightOnly ? [] : probeSteps.filter((step) => context.inputs.steps.includes(step.id));
  return runInOrder([preflightStep, ...later], context);
}

async function runProbe(inputs: ProbeInputs, secrets: ProbeSecrets): Promise<number> {
  const controller = new AbortController();
  const startedAt = new Date();
  const run = runToken(startedAt);
  const context: ProbeContext = {
    inputs, secrets, run, client: new RenderClient(secrets.renderKey, !inputs.preflightOnly), report: newReport(),
    state: newState(inputs, run), signal: controller.signal, startedAt,
  };
  stopOnSignal(controller, 'the services and the WorkOS fixtures');
  const passed = await runSteps(context);
  const cleaned = inputs.preflightOnly || await runStep(cleanupStep, { ...context, signal: AbortSignal.timeout(CLEANUP_LIMIT_MS) });
  process.stdout.write(renderReport(context));
  progress(`Render writes in this run: ${context.client.writes.length}; reads: ${context.client.reads}; WorkOS writes: ${context.report.workosWrites.length}`);
  return passed && cleaned ? 0 : 1;
}

const args = process.argv.slice(2);
process.exitCode = await runCommand(args, USAGE, async () => {
  const inputs = parseInputs(args);
  if (!inputs.dryRun) return runProbe(inputs, readSecrets(process.env));
  process.stdout.write(renderDryRun(inputs));
  return 0;
});
failIfAHandleKeepsTheProcessAlive();
