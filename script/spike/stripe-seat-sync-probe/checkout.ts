import type Stripe from 'stripe';
import { poll, type PollPlan } from '../render-tenant-lifecycle/polls.ts';
import { action, planned, type Placeholders, type PlannedCall } from './calls.ts';
import { PREFIX, progress, remember, seconds, stripeOf, type ProbeContext } from './context.ts';
import { checkRules, type Rule } from './rules.ts';
import { checkoutCall, createCheckoutCall, createCustomerCall, subscriptionCall } from './stripe-calls.ts';
import { CHECKOUT_LIFETIME_S, checkoutParams, customerParams } from './stripe-params.ts';

const STEP = 'Checkout';
// The operator has 15 minutes to pay in a browser. The session itself expires after 31 minutes.
export const CHECKOUT_POLL: PollPlan = { everyMs: 5_000, attempts: 180 };

export const OPERATOR_STEPS = [
  'Open the Checkout URL in a browser within 15 minutes. Pay with the Stripe test card 4242 4242 4242 4242, any future',
  'expiry date, and any CVC. Tick the terms box, and enter a billing address, for example in the United States. Stripe',
  'then opens example.com; close that page. The probe reads the session from Stripe.',
].join(' ');

function priceIdOf(context: ProbeContext): string {
  const id = context.secrets.priceId;
  if (id === undefined) throw new Error('No STRIPE_PRICE_ID.');
  return id;
}

async function subscriptionOf(context: ProbeContext, session: Stripe.Checkout.Session): Promise<Stripe.Subscription> {
  const value = session.subscription;
  if (value === null) throw new Error(`The complete session ${session.id} has no subscription.`);
  return typeof value === 'string' ? stripeOf(context).read(subscriptionCall(value), context.signal) : value;
}

async function waitForOperator(context: ProbeContext, session: Stripe.Checkout.Session): Promise<Stripe.Checkout.Session> {
  progress(`Checkout: ${OPERATOR_STEPS}`);
  progress(`Checkout URL: ${session.url ?? 'none'}`);
  return poll({ plan: CHECKOUT_POLL, signal: context.signal, what: `the operator to complete the Checkout Session ${session.id}` }, async () => {
    const read = await stripeOf(context).read(checkoutCall(session.id), context.signal);
    if (read.status === 'expired') throw new Error(`The Checkout Session ${session.id} expired before the operator completed it.`);
    return read.status === 'complete' ? read : undefined;
  });
}

const SESSION_RULES: readonly Rule<Stripe.Checkout.Session>[] = [
  ['status complete', (session) => session.status === 'complete'],
  ['consent.terms_of_service accepted', (session) => session.consent?.terms_of_service === 'accepted'],
  ['automatic_tax enabled', (session) => session.automatic_tax.enabled],
  ['a billing address', (session) => typeof session.customer_details?.address?.country === 'string'],
];

function subscriptionRules(priceId: string, run: string): readonly Rule<Stripe.Subscription>[] {
  return [
    ['status active', (subscription) => subscription.status === 'active'],
    [`one item with the price ${priceId}`, (subscription) => subscription.items.data.length === 1 && subscription.items.data[0]?.price.id === priceId],
    ['no quantity on the item', (subscription) => subscription.items.data[0]?.quantity === undefined || subscription.items.data[0]?.quantity === null],
    [`metadata thermus_probe_run ${run}`, (subscription) => subscription.metadata.thermus_probe_run === run],
  ];
}

function sessionFacts(session: Stripe.Checkout.Session, ms: number): string {
  const tax = `automatic_tax ${session.automatic_tax.status ?? 'no status'}, amount_tax ${session.total_details?.amount_tax ?? 'absent'}`;
  return `complete ${seconds(ms)} after the create; payment_status ${session.payment_status}; ${tax}; billing country ${session.customer_details?.address?.country ?? 'absent'}; tax IDs ${session.customer_details?.tax_ids?.length ?? 0}`;
}

function subscriptionFacts(subscription: Stripe.Subscription): string {
  const item = subscription.items.data[0];
  return `${subscription.id} ${subscription.status}; billing_mode ${subscription.billing_mode.type}; item quantity ${item?.quantity ?? 'absent'}; period ends ${item === undefined ? 'unknown' : new Date(item.current_period_end * 1_000).toISOString()}`;
}

async function checkout(context: ProbeContext): Promise<string> {
  const stripe = stripeOf(context);
  const priceId = priceIdOf(context);
  const customer = await stripe.write(STEP, createCustomerCall(customerParams(context.run, 'checkout')), context.signal);
  remember(context, { system: 'Stripe', kind: 'customer', id: customer.id, step: STEP });
  const expiresAt = Math.floor(Date.now() / 1_000) + CHECKOUT_LIFETIME_S;
  const created = performance.now();
  const session = await stripe.write(STEP, createCheckoutCall(checkoutParams(context.run, { priceId, customer: customer.id, expiresAt })), context.signal);
  remember(context, { system: 'Stripe', kind: 'checkout session', id: session.id, step: STEP });
  const done = await waitForOperator(context, session);
  const subscription = await subscriptionOf(context, done);
  remember(context, { system: 'Stripe', kind: 'subscription', id: subscription.id, step: STEP });
  checkRules(context, { step: STEP, what: `Checkout Session ${session.id}`, value: done, measured: sessionFacts(done, performance.now() - created) }, SESSION_RULES);
  checkRules(context, { step: STEP, what: 'Subscription of the session', value: subscription, measured: subscriptionFacts(subscription) }, subscriptionRules(priceId, context.run));
  return `the operator completed ${session.id}: terms accepted, automatic tax ${done.automatic_tax.status ?? 'no status'}, and the subscription ${subscription.id} is active with no quantity.`;
}

export function checkoutPlan(_inputs: unknown, values: Placeholders): readonly PlannedCall[] {
  const params = { ...checkoutParams(values.run, { priceId: values.priceId, customer: '{customerId}', expiresAt: 0 }), expires_at: `{now + ${CHECKOUT_LIFETIME_S}}` };
  return [
    planned(createCustomerCall(customerParams(values.run, 'checkout')), 'The customer of the session, as SO-13 creates or reuses one before Checkout.'),
    { ...planned(createCheckoutCall(checkoutParams(values.run, { priceId: values.priceId, customer: '{customerId}', expiresAt: 0 })), 'expires_at is 31 minutes after the create. No quantity: the price is metered.'), params },
    action('(operator)', `The probe prints the session URL on stderr. ${OPERATOR_STEPS}`),
    planned(checkoutCall('{sessionId}'), `Every ${CHECKOUT_POLL.everyMs / 1_000} s, at most ${CHECKOUT_POLL.attempts} times (15 minutes), until the status is complete; expired fails the step.`),
    action('(checks)', `status complete; consent.terms_of_service accepted; automatic_tax enabled; a billing address; the subscription active, with the price and no quantity, and the metadata of the run. client_reference_id is ${PREFIX}${values.run}.`),
  ];
}

export { checkout };
