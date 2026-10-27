import { checkout, checkoutPlan } from './checkout.ts';
import { cleanup, cleanupPlan, sweep, sweepPlan } from './cleanup.ts';
import { redacted, type ProbeStep } from './context.ts';
import type { WorkStepId } from './inputs.ts';
import { preflight, preflightPlan } from './preflight.ts';
import { seatSync, seatSyncPlan, seatSyncWorkOSOnly, workosOnlyPlan } from './seat-sync.ts';
import { testClock, testClockPlan } from './test-clock.ts';
import { webhook, webhookPlan } from './webhook.ts';

type WorkStep = ProbeStep & { readonly id: WorkStepId };

// Each step asserts one Given-When-Then specification of the ticket, through the public APIs of Stripe and WorkOS.

export const preflightStep: ProbeStep = {
  name: 'Preflight',
  spec: 'Given the inputs, when the probe reads the price, its meter, the settings that the steps need, and the objects of earlier runs, then the price is a metered monthly USD price on the meter workos_seat_count with the last aggregation, and no object of an earlier run exists.',
  run: redacted(preflight),
  plan: preflightPlan,
};

export const workSteps: readonly WorkStep[] = [
  {
    id: 'seat-sync', name: 'Seat sync',
    spec: 'Given a new Stripe customer and a disposable WorkOS organization with that stripe_customer_id, when the probe adds one membership, then a second, and then removes one, then the meter shows the counts 1, 2, and 1, and the record has the delay of each event.',
    run: redacted(seatSync), plan: seatSyncPlan,
  },
  {
    id: 'checkout', name: 'Checkout',
    spec: 'Given the price, when the probe creates a Checkout Session in subscription mode with required terms acceptance and Stripe Tax, and the operator completes it with a Stripe test card, then the session shows the accepted terms and an active subscription without a quantity.',
    run: redacted(checkout), plan: checkoutPlan,
  },
  {
    id: 'webhook', name: 'Webhook',
    spec: "Given the Stripe CLI forwarding to the probe's local listener, when the CLI triggers a subscription event, then the listener accepts the signed event and refuses a changed payload.",
    run: redacted(webhook), plan: webhookPlan,
  },
  {
    id: 'test-clock', name: 'Test clock',
    spec: 'Given a test clock customer with the metered price and three reported seats, when the clock passes the period end, then the invoice is three times the price; when the payment method fails and the clock passes the retries, then the subscription is past_due and then canceled.',
    run: redacted(testClock), plan: testClockPlan,
  },
];

export const workosOnlyStep: WorkStep = {
  id: 'seat-sync', name: 'Seat sync (WorkOS only)',
  spec: 'Given no Stripe key, when the probe creates a disposable WorkOS organization, sets a stripe_customer_id of a fake format, adds one membership, then a second, and then removes one, then the record says whether WorkOS accepts the field without the Stripe add-on, and WorkOS shows 1, 2, and 1 active memberships.',
  run: redacted(seatSyncWorkOSOnly), plan: workosOnlyPlan,
};

export const cleanupStep: ProbeStep = {
  name: 'Cleanup',
  spec: 'Given the end of the probe, when it cleans up, then the subscriptions, the customers, the test clock, and the WorkOS organization and users of this run are deleted, also after a failure or the first stop signal.',
  run: redacted(cleanup), plan: cleanupPlan,
};

export const sweepStep: ProbeStep = {
  name: 'Sweep',
  spec: 'Given objects of earlier runs, when the probe runs with --steps cleanup, then it deletes each WorkOS organization and user with the probe prefix and each Stripe customer and test clock with the probe tag, and none remains.',
  run: redacted(sweep), plan: sweepPlan,
};
