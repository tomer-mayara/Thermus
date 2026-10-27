import type Stripe from 'stripe';
import { planned, type Placeholders, type PlannedCall } from './calls.ts';
import { advanceTo, CLOCK_POLL, day, HOUR, passRetries } from './clock.ts';
import { addRow, remember, seconds, stripeOf, type ProbeContext } from './context.ts';
import { waitForSeats } from './meter.ts';
import { checkRules } from './rules.ts';
import { meterOf, summaryRead } from './seat-sync.ts';
import {
  advanceClockCall, attachPaymentMethodCall, clockCall, createClockCall, createCustomerCall, createSubscriptionCall, invoiceCall, invoicesCall,
  meterEventCall, setPaymentMethodCall, subscriptionCall,
} from './stripe-calls.ts';
import { CLOCK_SEATS, clockParams, clockSubscriptionParams, customerParams, EXPECTED_METER, FAILING_PAYMENT_METHOD, seatEventParams } from './stripe-params.ts';

const STEP = 'Test clock';
// "By default, the invoice appears in a draft status for one hour" (test clock guide); the payment attempt follows.
const AFTER_PERIOD_S = 2 * HOUR;

function priceOf(context: ProbeContext): Stripe.Price {
  const price = context.state.price;
  if (price?.unit_amount === undefined || price.unit_amount === null) throw new Error('No price: the preflight did not read a price with a unit_amount.');
  return price;
}

interface Simulation {
  readonly clock: Stripe.TestHelpers.TestClock;
  readonly customer: Stripe.Customer;
  readonly subscription: Stripe.Subscription;
}

// A customer on a new test clock, with a card that Stripe attaches but cannot charge, and the metered price.
async function simulation(context: ProbeContext, priceId: string): Promise<Simulation> {
  const stripe = stripeOf(context);
  const clock = await stripe.write(STEP, createClockCall(clockParams(context.run, Math.floor(Date.now() / 1_000))), context.signal);
  remember(context, { system: 'Stripe', kind: 'test clock', id: clock.id, step: STEP });
  const customer = await stripe.write(STEP, createCustomerCall({ ...customerParams(context.run, 'test-clock'), test_clock: clock.id }), context.signal);
  remember(context, { system: 'Stripe', kind: 'customer', id: customer.id, step: STEP });
  const card = await stripe.write(STEP, attachPaymentMethodCall(FAILING_PAYMENT_METHOD, customer.id), context.signal);
  await stripe.write(STEP, setPaymentMethodCall(customer.id, card.id), context.signal);
  const subscription = await stripe.write(STEP, createSubscriptionCall(clockSubscriptionParams(context.run, customer.id, priceId)), context.signal);
  remember(context, { system: 'Stripe', kind: 'subscription', id: subscription.id, step: STEP });
  checkRules(context, { step: STEP, what: `Subscription ${subscription.id} on the clock ${clock.id}`, value: subscription, measured: `${subscription.status} at ${day(clock.frozen_time)} UTC` }, [['status active', (value) => value.status === 'active']]);
  return { clock, customer, subscription };
}

// One meter event of the probe reports the three seats inside the first period. Its timestamp is one second after
// the frozen time of the clock, so that it is valid both against the clock and against the time of this machine.
async function reportSeats(context: ProbeContext, setup: Simulation): Promise<void> {
  const meter = meterOf(context);
  const timestamp = setup.clock.frozen_time + 1;
  const sent = performance.now();
  await stripeOf(context).write(STEP, meterEventCall(seatEventParams(meter, { run: context.run, customer: setup.customer.id, timestamp })), context.signal);
  const window = { meterId: meter.id, customerId: setup.customer.id, since: setup.clock.frozen_time };
  const wait = await waitForSeats(context, window, { expected: CLOCK_SEATS, from: sent });
  addRow(context, STEP, { check: `Meter event of ${CLOCK_SEATS} seats at ${day(timestamp)} UTC`, expected: `the meter shows ${CLOCK_SEATS}`, measured: `${CLOCK_SEATS} after ${seconds(wait.ms)}` });
}

async function cycleInvoice(context: ProbeContext, subscriptionId: string): Promise<Stripe.Invoice> {
  const invoices = await stripeOf(context).read(invoicesCall(subscriptionId), context.signal);
  const cycle = invoices.data.filter((invoice) => invoice.billing_reason === 'subscription_cycle').sort((first, second) => first.created - second.created)[0];
  if (cycle === undefined) throw new Error(`No subscription_cycle invoice after the period end. Invoices: ${invoices.data.map((invoice) => `${invoice.id} ${invoice.billing_reason ?? ''}`).join(', ') || 'none'}.`);
  return cycle;
}

interface Billed {
  readonly invoice: Stripe.Invoice;
  readonly clockTime: number;
}

async function billPeriod(context: ProbeContext, setup: Simulation): Promise<Billed> {
  const periodEnd = setup.subscription.items.data[0]?.current_period_end;
  if (periodEnd === undefined) throw new Error('The subscription has no item with a current period.');
  const first = await advanceTo(context, setup.clock.id, periodEnd + AFTER_PERIOD_S);
  addRow(context, STEP, { check: `Advance to the period end + 2 h, ${day(periodEnd + AFTER_PERIOD_S)} UTC`, expected: 'ready', measured: `ready after ${seconds(first.ms)}` });
  const invoice = await cycleInvoice(context, setup.subscription.id);
  const expected = CLOCK_SEATS * (priceOf(context).unit_amount ?? 0);
  const facts = `${invoice.id}: subtotal ${invoice.subtotal}, total ${invoice.total}, amount_due ${invoice.amount_due} ${invoice.currency ?? ''}; status ${invoice.status ?? 'none'}; attempt_count ${invoice.attempt_count}`;
  checkRules(context, { step: STEP, what: 'Invoice of the first period', value: invoice, measured: facts }, [
    [`subtotal ${expected}: ${CLOCK_SEATS} times ${priceOf(context).unit_amount ?? 0}`, (value) => value.subtotal === expected],
    ['status open after the failed payment', (value) => value.status === 'open'],
    ['attempt_count at least 1', (value) => value.attempt_count >= 1],
  ]);
  return { invoice, clockTime: first.clock.frozen_time };
}

async function testClock(context: ProbeContext): Promise<string> {
  const setup = await simulation(context, priceOf(context).id);
  await reportSeats(context, setup);
  const { invoice, clockTime } = await billPeriod(context, setup);
  const pastDue = await stripeOf(context).read(subscriptionCall(setup.subscription.id), context.signal);
  checkRules(context, { step: STEP, what: 'Subscription after the failed payment', value: pastDue, measured: pastDue.status }, [['status past_due', (value) => value.status === 'past_due']]);
  const track = { clockId: setup.clock.id, subscriptionId: setup.subscription.id, invoiceId: invoice.id, from: invoice.created, clockTime };
  const ended = await passRetries(context, track);
  const facts = `${ended.subscription.status} ${ended.days} days after the invoice, after ${ended.advances} advances; attempt_count ${ended.invoice.attempt_count}; cancellation_details.reason ${ended.subscription.cancellation_details?.reason ?? 'none'}`;
  checkRules(context, { step: STEP, what: 'Subscription after the retries', value: ended.subscription, measured: facts }, [['status canceled', (value) => value.status === 'canceled']]);
  return `the invoice ${invoice.id} of the first period was ${invoice.subtotal} for ${CLOCK_SEATS} seats; the subscription ${setup.subscription.id} was past_due after the failed payment and canceled ${ended.days} days later, after ${ended.invoice.attempt_count} attempts.`;
}

// The dry run shows a parameter that real mode computes as a placeholder.
function shown(call: PlannedCall, values: Readonly<Record<string, string>>): PlannedCall {
  return { ...call, params: { ...(call.params as object), ...values } };
}

export function testClockPlan(_inputs: unknown, values: Placeholders): readonly PlannedCall[] {
  const now = Math.floor(Date.now() / 1_000);
  const clock = '{testClockId}';
  const event = planned(meterEventCall(seatEventParams(EXPECTED_METER, { run: values.run, customer: '{customerId}', timestamp: now })), 'Three seats, one second after the frozen time. Real mode uses the event name and payload keys of the meter.');
  return [
    shown(planned(createClockCall(clockParams(values.run, now)), 'The frozen time starts at the time of this machine.'), { frozen_time: '{now}' }),
    planned(createCustomerCall({ ...customerParams(values.run, 'test-clock'), test_clock: clock }), 'The customer of the clock.'),
    planned(attachPaymentMethodCall(FAILING_PAYMENT_METHOD, '{customerId}'), 'The test card 4000 0000 0000 0341: it attaches, but each charge fails. The answer gives {paymentMethodId}.'),
    planned(setPaymentMethodCall('{customerId}', '{paymentMethodId}'), 'The default payment method of the invoices.'),
    planned(createSubscriptionCall(clockSubscriptionParams(values.run, '{customerId}', values.priceId)), 'The status must be active: the first invoice has no usage to bill.'),
    shown(event, { timestamp: '{frozen_time + 1}' }),
    summaryRead(values, '{customerId}', 'Every 2 s, at most 300 times, until aggregated_value is 3.'),
    shown(planned(advanceClockCall(clock, now), 'To the current_period_end of the subscription item plus 2 hours.'), { frozen_time: '{current_period_end + 7200}' }),
    planned(clockCall(clock), `Every ${CLOCK_POLL.everyMs / 1_000} s, at most ${CLOCK_POLL.attempts} times, until the status is ready; internal_failure fails the step.`),
    planned(invoicesCall('{subscriptionId}'), 'The subscription_cycle invoice: subtotal 3 times the unit_amount of the price, status open, attempt_count at least 1.'),
    planned(subscriptionCall('{subscriptionId}'), 'The status must be past_due.'),
    planned(invoiceCall('{invoiceId}'), 'Then, at most 14 times: advance to one hour after next_payment_attempt (or 7 days on), wait for ready, and read the subscription and the invoice, until the subscription is canceled; past_due after 63 days fails the step.'),
  ];
}

export { testClock };
