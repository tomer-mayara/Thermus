#!/usr/bin/env node
// SO-01f: the Stripe Checkout, webhook, test clock, and WorkOS seat sync probe of the self on-boarding plan, Slice 1.
// In Stripe test mode and the WorkOS Staging environment, it checks that the WorkOS Stripe add-on reports the active
// membership count of an organization to the "User Seat Count" meter, that a Checkout Session in subscription mode
// collects the terms acceptance and Stripe Tax for the metered price, that a local listener accepts a webhook event of
// the Stripe CLI only with its signature, and that a test clock bills the reported seats and ends a subscription
// after its failed payment retries. Each step of stripe-seat-sync-probe/steps.ts asserts one Given-When-Then
// specification of the ticket. docs/implementation/self-onboarding-s1.md (section SO-01f) names the documentation
// page of each call and the permissions of the restricted key.
// Rules: every object carries the run token in its name, email, or metadata, and the cleanup deletes it, also after a
// failure or the first stop signal. The secrets come only from the environment, and no output holds one. A live
// Stripe key, a WorkOS production key, and the WorkOS production client stop the probe before any call. At the end,
// the script prints a Markdown report: the step table, the seat events with their delays, the objects created and
// deleted, the writes, and one conclusion for each step. This is a probe, not production code. Run it from the
// repository root: --help prints the usage.
import { failIfAHandleKeepsTheProcessAlive, runCommand, runInOrder, runStep, stopOnSignal } from './render-tenant-lifecycle/runner.ts';
import { newContext, progress, runTokenOf, type ProbeContext, type ProbeStep } from './stripe-seat-sync-probe/context.ts';
import { renderDryRun } from './stripe-seat-sync-probe/dry-run.ts';
import { parseInputs, USAGE, type ProbeInputs } from './stripe-seat-sync-probe/inputs.ts';
import { renderReport } from './stripe-seat-sync-probe/report.ts';
import { readSecrets, type ProbeSecrets } from './stripe-seat-sync-probe/secrets.ts';
import { cleanupStep, preflightStep, sweepStep, workosOnlyStep, workSteps } from './stripe-seat-sync-probe/steps.ts';
import { StripeProbeClient } from './stripe-seat-sync-probe/stripe-client.ts';
import { WorkOSProbeClient } from './stripe-seat-sync-probe/workos-client.ts';

const CLEANUP_LIMIT_MS = 10 * 60_000;

function allowWrites(context: ProbeContext): void {
  context.stripe?.allowWrites();
  context.workos?.allowWrites();
}

const preflightThenWrites: ProbeStep = {
  ...preflightStep,
  run: async (context) => {
    const conclusion = await preflightStep.run(context);
    allowWrites(context);
    return conclusion;
  },
};

function runSteps(context: ProbeContext): Promise<boolean> {
  const { inputs } = context;
  const work = inputs.workosOnly ? [workosOnlyStep] : workSteps.filter((step) => inputs.steps.includes(step.id));
  return runInOrder([preflightThenWrites, ...work], context);
}

function newProbeContext(inputs: ProbeInputs, secrets: ProbeSecrets, signal: AbortSignal): ProbeContext {
  const startedAt = new Date();
  return newContext({
    inputs, run: runTokenOf(startedAt), secrets, signal, startedAt,
    stripe: secrets.stripeKey === undefined ? undefined : new StripeProbeClient(secrets.stripeKey),
    workos: secrets.workosKey === undefined ? undefined : new WorkOSProbeClient(secrets.workosKey),
  });
}

async function runProbe(inputs: ProbeInputs, secrets: ProbeSecrets): Promise<number> {
  const controller = new AbortController();
  const context = newProbeContext(inputs, secrets, controller.signal);
  stopOnSignal(controller, 'objects of the run');
  progress(`run ${context.run}: each object of this run carries this token.`);
  const passed = inputs.sweep || await runSteps(context);
  allowWrites(context);
  const finalContext = { ...context, inputs: { ...inputs, keep: inputs.keep && passed }, signal: AbortSignal.timeout(CLEANUP_LIMIT_MS) };
  const cleaned = await runStep(inputs.sweep ? sweepStep : cleanupStep, finalContext);
  process.stdout.write(renderReport(context));
  return passed && cleaned ? 0 : 1;
}

const args = process.argv.slice(2);
process.exitCode = await runCommand(args, USAGE, async () => {
  const inputs = parseInputs(args);
  if (!inputs.dryRun) return runProbe(inputs, readSecrets(process.env, inputs));
  process.stdout.write(renderDryRun(inputs, process.env));
  return 0;
});
failIfAHandleKeepsTheProcessAlive();
