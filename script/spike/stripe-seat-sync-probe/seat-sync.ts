import type { Organization } from '@workos-inc/node';
import type Stripe from 'stripe';
import { planned, type Placeholders, type PlannedCall } from './calls.ts';
import { addRow, messageOf, objectName, remember, seconds, stripeOf, workosOf, type ProbeContext } from './context.ts';
import { changeMemberships, membershipPlan, type Observe } from './members.ts';
import { seatValue, shownValue, summaryRange, waitForSeats, type SeatWindow } from './meter.ts';
import { createCustomerCall, meterSummaryCall } from './stripe-calls.ts';
import { customerParams } from './stripe-params.ts';
import { createOrganizationCall, organizationCall, setStripeCustomerCall } from './workos-calls.ts';
import { statusOf } from './workos-client.ts';

const STEP = 'Seat sync';
const WORKOS_ONLY_STEP = 'Seat sync (WorkOS only)';

async function createOrganization(context: ProbeContext, step: string): Promise<Organization> {
  const organization = await workosOf(context).write(step, createOrganizationCall(objectName(context.run, 'seat-sync')), context.signal);
  remember(context, { system: 'WorkOS', kind: 'organization', id: organization.id, step });
  return organization;
}

export function meterOf(context: ProbeContext): Stripe.Billing.Meter {
  const meter = context.state.meter;
  if (meter === undefined) throw new Error('No meter: the preflight did not read the meter of the price.');
  return meter;
}

function meterObserver(context: ProbeContext, window: SeatWindow): Observe {
  return async (expected, answeredAt) => {
    const wait = await waitForSeats(context, window, { expected, from: answeredAt });
    return { meter: `${expected} after ${wait.reads} reads; values seen: ${wait.seen.join(' > ')}`, delay: seconds(wait.ms) };
  };
}

async function seatSync(context: ProbeContext): Promise<string> {
  const since = Math.floor(Date.now() / 1_000);
  const organization = await createOrganization(context, STEP);
  const params = customerParams(context.run, 'seat-sync', { workos_organization_id: organization.id });
  const customer = await stripeOf(context).write(STEP, createCustomerCall(params), context.signal);
  remember(context, { system: 'Stripe', kind: 'customer', id: customer.id, step: STEP });
  const linked = await workosOf(context).write(STEP, setStripeCustomerCall(organization.id, customer.id), context.signal);
  addRow(context, STEP, { check: 'stripe_customer_id of the organization', expected: customer.id, measured: linked.stripeCustomerId ?? 'absent' });
  if (linked.stripeCustomerId !== customer.id) throw new Error(`The organization shows stripe_customer_id ${linked.stripeCustomerId ?? 'absent'}, not ${customer.id}.`);
  const window: SeatWindow = { meterId: meterOf(context).id, customerId: customer.id, since };
  addRow(context, STEP, { check: 'Meter before the first membership', expected: 'recorded: no summary, or 0', measured: shownValue(await seatValue(context, window)) });
  await changeMemberships(context, { step: STEP, organizationId: organization.id, observe: meterObserver(context, window) });
  const delays = context.report.seatEvents.map((event) => event.delay).join(', ');
  return `the meter of ${customer.id} showed 1, 2, and 1 after the membership changes of ${organization.id}; delays after the WorkOS answers: ${delays}.`;
}

// A value with the format of a Stripe customer ID. No Stripe customer has it.
export function fakeCustomerId(run: string): string {
  return `cus_ThermusSpike${run.slice(-4)}`;
}

// A 4xx answer is a result to record. A network failure or a 5xx answer fails the step.
async function linkFakeCustomer(context: ProbeContext, organizationId: string, fake: string): Promise<string> {
  try {
    const linked = await workosOf(context).write(WORKOS_ONLY_STEP, setStripeCustomerCall(organizationId, fake), context.signal);
    return `accepted: the answer shows stripe_customer_id ${linked.stripeCustomerId ?? 'absent'}`;
  } catch (error) {
    const status = statusOf(error);
    if (status === undefined || status >= 500) throw error;
    return `refused: ${messageOf(error)}`;
  }
}

async function seatSyncWorkOSOnly(context: ProbeContext): Promise<string> {
  const organization = await createOrganization(context, WORKOS_ONLY_STEP);
  const fake = fakeCustomerId(context.run);
  const outcome = await linkFakeCustomer(context, organization.id, fake);
  addRow(context, WORKOS_ONLY_STEP, { check: `stripe_customer_id ${fake}, Stripe add-on not connected`, expected: 'recorded: accepted or refused', measured: outcome });
  const read = await workosOf(context).read(organizationCall(organization.id), context.signal);
  addRow(context, WORKOS_ONLY_STEP, { check: 'stripe_customer_id after a read of the organization', expected: 'recorded', measured: read.stripeCustomerId ?? 'absent' });
  await changeMemberships(context, { step: WORKOS_ONLY_STEP, organizationId: organization.id });
  return `WorkOS ${outcome.split(':')[0]} the stripe_customer_id ${fake} without the Stripe add-on (read back: ${read.stripeCustomerId ?? 'absent'}); ${organization.id} showed 1, 2, and 1 active memberships.`;
}

// The dry run shows the summary range of a step that starts now; real mode computes it for each read.
function summaryRead(values: Placeholders, note: string): PlannedCall {
  const now = Math.floor(Date.now() / 1_000);
  return planned(meterSummaryCall(values.meterId, { customer: '{customerId}', ...summaryRange(now, now) }), note);
}

export function seatSyncPlan(_inputs: unknown, values: Placeholders): readonly PlannedCall[] {
  const organization = '{organizationId}';
  const range = 'start_time is the minute boundary before the step start, and end_time the boundary after the read.';
  return [
    planned(createOrganizationCall(objectName(values.run, 'seat-sync')), 'The disposable organization of this run.'),
    planned(createCustomerCall(customerParams(values.run, 'seat-sync', { workos_organization_id: organization })), 'The Stripe customer of the organization.'),
    planned(setStripeCustomerCall(organization, '{customerId}'), 'The answer must show this stripe_customer_id.'),
    summaryRead(values, `One read before the first membership, for the record. ${range}`),
    ...membershipPlan(values.run, organization, (expected) => [summaryRead(values, `Every 2 s, at most 300 times, until aggregated_value is ${expected}.`)]),
  ];
}

export function workosOnlyPlan(_inputs: unknown, values: Placeholders): readonly PlannedCall[] {
  const organization = '{organizationId}';
  return [
    planned(createOrganizationCall(objectName(values.run, 'seat-sync')), 'The disposable organization of this run.'),
    planned(setStripeCustomerCall(organization, fakeCustomerId(values.run)), 'A fake customer ID. The record says whether WorkOS accepts it without the Stripe add-on.'),
    planned(organizationCall(organization), 'The stripe_customer_id that WorkOS keeps, for the record.'),
    ...membershipPlan(values.run, organization, () => []),
  ];
}

export { seatSync, seatSyncWorkOSOnly };
