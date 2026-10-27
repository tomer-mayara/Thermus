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
import { progress } from './render-tenant-lifecycle/context.ts';
import { readApiKey } from './render-tenant-lifecycle/inputs.ts';
import { RenderClient } from './render-tenant-lifecycle/render-client.ts';
import { failIfAHandleKeepsTheProcessAlive, runCommand, runInOrder, runStep, runToken, stopOnSignal } from './render-tenant-lifecycle/runner.ts';
import { cleanupStep } from './private-network-probe/cleanup.ts';
import { newState, type ProbeContext } from './private-network-probe/context.ts';
import { renderDryRun } from './private-network-probe/dry-run.ts';
import { parseInputs, USAGE, type ProbeInputs } from './private-network-probe/inputs.ts';
import { renderReport } from './private-network-probe/report.ts';
import { preflightStep, probeSteps } from './private-network-probe/steps.ts';

const CLEANUP_LIMIT_MS = 10 * 60_000;

function runSteps(context: ProbeContext): Promise<boolean> {
  const later = context.inputs.preflightOnly ? [] : probeSteps.filter((step) => context.inputs.steps.includes(step.id));
  return runInOrder([preflightStep, ...later], context);
}

async function runProbe(inputs: ProbeInputs, key: string): Promise<number> {
  const controller = new AbortController();
  const startedAt = new Date();
  const run = runToken(startedAt);
  const context: ProbeContext = {
    inputs, run, client: new RenderClient(key, !inputs.preflightOnly), report: { rows: [], transcript: [], conclusions: [] },
    state: newState(inputs, run), signal: controller.signal, startedAt,
  };
  stopOnSignal(controller, 'the services');
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
  process.stdout.write(renderDryRun(inputs));
  return 0;
});
failIfAHandleKeepsTheProcessAlive();
