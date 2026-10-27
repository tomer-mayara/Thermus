import type Stripe from 'stripe';
import { poll, type PollPlan } from '../render-tenant-lifecycle/polls.ts';
import { addRow, stripeOf, type ProbeContext } from './context.ts';
import { advanceClockCall, clockCall, invoiceCall, subscriptionCall } from './stripe-calls.ts';

// The test clock guide says that an advance takes a few seconds. Each advance waits at most 5 minutes for the status
// ready.
export const CLOCK_POLL: PollPlan = { everyMs: 2_000, attempts: 150 };
export const HOUR = 3_600;
const DAY = 86_400;
const RETRY_STEP_S = 7 * DAY;
// The longest Smart Retries window is 2 months, and one advance may not pass two intervals of the subscription.
const RETRY_WINDOW_S = 63 * DAY;
const RETRY_ADVANCES = 14;

const STEP = 'Test clock';

export function day(timestamp: number): string {
  return new Date(timestamp * 1_000).toISOString().slice(0, 16).replace('T', ' ');
}

export interface Advance {
  readonly ms: number;
  readonly clock: Stripe.TestHelpers.TestClock;
}

export async function advanceTo(context: ProbeContext, clockId: string, target: number): Promise<Advance> {
  const stripe = stripeOf(context);
  const started = performance.now();
  await stripe.write(STEP, advanceClockCall(clockId, target), context.signal);
  const clock = await poll({ plan: CLOCK_POLL, signal: context.signal, what: `the test clock ${clockId} to reach ${day(target)} UTC` }, async () => {
    const read = await stripe.read(clockCall(clockId), context.signal);
    if (read.status === 'internal_failure') throw new Error(`The test clock ${clockId} stopped with the status internal_failure.`);
    return read.status === 'ready' && read.frozen_time >= target ? read : undefined;
  });
  return { ms: performance.now() - started, clock };
}

export interface Retries {
  readonly subscription: Stripe.Subscription;
  readonly invoice: Stripe.Invoice;
  readonly advances: number;
  readonly days: number;
}

interface Track {
  readonly clockId: string;
  readonly subscriptionId: string;
  readonly invoiceId: string;
  readonly invoiceCreated: number;
  readonly clockTime: number;
}

// One hour after the next payment attempt lets that attempt run. When the invoice has no next attempt, the
// subscription changes state at the end of the retry window, so the clock goes 7 days on.
function nextTarget(invoice: Stripe.Invoice, frozen: number): number {
  return invoice.next_payment_attempt === null ? frozen + RETRY_STEP_S : Math.max(invoice.next_payment_attempt + HOUR, frozen + HOUR);
}

export async function passRetries(context: ProbeContext, track: Track): Promise<Retries> {
  const stripe = stripeOf(context);
  let frozen = track.clockTime;
  for (let advances = 0; advances <= RETRY_ADVANCES; advances++) {
    const subscription = await stripe.read(subscriptionCall(track.subscriptionId), context.signal);
    const invoice = await stripe.read(invoiceCall(track.invoiceId), context.signal);
    const days = Math.round((frozen - track.invoiceCreated) / DAY);
    if (subscription.status === 'canceled') return { subscription, invoice, advances, days };
    if (subscription.status !== 'past_due') throw new Error(`The subscription is ${subscription.status} during the payment retries, not past_due.`);
    if (frozen - track.invoiceCreated >= RETRY_WINDOW_S || advances === RETRY_ADVANCES) break;
    const target = nextTarget(invoice, frozen);
    const { clock, ms } = await advanceTo(context, track.clockId, target);
    frozen = clock.frozen_time;
    const next = invoice.next_payment_attempt === null ? 'none' : day(invoice.next_payment_attempt);
    addRow(context, STEP, { check: `Retry advance ${advances + 1} to ${day(frozen)} UTC`, expected: 'ready; recorded', measured: `ready after ${(ms / 1_000).toFixed(1)} s; before it: invoice attempt_count ${invoice.attempt_count}, next attempt ${next}` });
  }
  throw new Error(`The subscription stayed past_due ${Math.round((frozen - track.invoiceCreated) / DAY)} days after the first failed payment. Set Billing > Revenue recovery > Retries to cancel the subscription after the last retry.`);
}
