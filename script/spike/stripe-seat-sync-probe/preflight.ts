import type Stripe from 'stripe';
import { action, planned, type Placeholders, type PlannedCall } from './calls.ts';
import { earlierObjects, earlierObjectsPlan, systemsOf } from './cleanup.ts';
import { addRow, messageOf, stripeOf, type ProbeContext } from './context.ts';
import { usesStripe, type ProbeInputs } from './inputs.ts';
import { checkRules, type Rule } from './rules.ts';
import { cliVersion, readSigningSecret } from './stripe-cli.ts';
import { defaultPortalCall, meterCall, priceCall, taxSettingsCall } from './stripe-calls.ts';
import { EXPECTED_METER } from './stripe-params.ts';

const STEP = 'Preflight';

// The price of the owner steps: a metered monthly price in USD on the meter of the WorkOS seat sync. The test clock
// step needs a whole-cent unit amount, so that three seats bill three times that amount.
const PRICE_RULES: readonly Rule<Stripe.Price>[] = [
  ['active', (price) => price.active],
  ['currency usd', (price) => price.currency === 'usd'],
  ['recurring every 1 month', (price) => price.recurring?.interval === 'month' && price.recurring.interval_count === 1],
  ['usage_type metered', (price) => price.recurring?.usage_type === 'metered'],
  ['a meter', (price) => typeof price.recurring?.meter === 'string'],
  ['billing_scheme per_unit without transform_quantity', (price) => price.billing_scheme === 'per_unit' && price.transform_quantity === null],
  ['a whole-cent unit_amount', (price) => price.unit_amount !== null],
];

const METER_RULES: readonly Rule<Stripe.Billing.Meter>[] = [
  [`event_name ${EXPECTED_METER.event_name}`, (meter) => meter.event_name === EXPECTED_METER.event_name],
  ['default_aggregation last', (meter) => meter.default_aggregation.formula === 'last'],
  ['status active', (meter) => meter.status === 'active'],
];

const PORTAL_RULES: readonly Rule<Stripe.BillingPortal.Configuration>[] = [
  ['cancellation on', (portal) => portal.features.subscription_cancel.enabled],
  ['cancellation at the period end', (portal) => portal.features.subscription_cancel.mode === 'at_period_end'],
  ['no quantity update', (portal) => !portal.features.subscription_update.enabled || !portal.features.subscription_update.default_allowed_updates.includes('quantity')],
];

// An owner setting that does not hold stops the run before any write: the record names the owner step.
function check<T>(context: ProbeContext, subject: { readonly what: string; readonly value: T }, rules: readonly Rule<T>[]): void {
  try {
    checkRules(context, { step: STEP, ...subject }, rules);
  } catch (error) {
    throw new Error(`${messageOf(error)} See the owner steps of the record.`, { cause: error });
  }
}

async function readPriceAndMeter(context: ProbeContext, priceId: string): Promise<string> {
  const stripe = stripeOf(context);
  const price = await stripe.read(priceCall(priceId), context.signal);
  check(context, { what: `Price ${priceId}`, value: price }, PRICE_RULES);
  const meter = await stripe.read(meterCall(price.recurring?.meter ?? ''), context.signal);
  check(context, { what: `Meter ${meter.id} (${meter.display_name})`, value: meter }, METER_RULES);
  context.state.price = price;
  context.state.meter = meter;
  const keys = `payload keys ${meter.customer_mapping.event_payload_key} and ${meter.value_settings.event_payload_key}`;
  return `the price ${priceId} bills ${price.unit_amount ?? 0} cents for each seat on the meter "${meter.display_name}" (${meter.event_name}, ${keys})`;
}

// Checkout with automatic tax needs Tax settings with the status active, and the owner steps set the portal.
async function readCheckoutSettings(context: ProbeContext): Promise<string> {
  const stripe = stripeOf(context);
  const tax = await stripe.read(taxSettingsCall(), context.signal);
  check(context, { what: 'Tax settings', value: tax }, [['status active', (settings) => settings.status === 'active']]);
  const portals = await stripe.read(defaultPortalCall(), context.signal);
  const portal = portals.data[0];
  if (portal === undefined) throw new Error('No default Customer Portal configuration: save the Customer Portal settings in the Stripe Dashboard (test mode).');
  check(context, { what: `Customer Portal ${portal.id}`, value: portal }, PORTAL_RULES);
  return 'the tax settings are active, and the Customer Portal cancels at the period end with no quantity update';
}

async function readCli(context: ProbeContext): Promise<string> {
  const version = await cliVersion(context.signal);
  context.state.cliVersion = version;
  context.state.signingSecret = await readSigningSecret(context.signal);
  addRow(context, STEP, { check: 'Stripe CLI', expected: 'installed, and signed in: stripe listen --print-secret gives a signing secret', measured: `${version}; the signing secret was read (not printed)` });
  return `the Stripe CLI (${version}) is signed in`;
}

async function noEarlierObjects(context: ProbeContext): Promise<string> {
  const objects = await earlierObjects(context);
  const listed = objects.map((object) => `${object.system} ${object.kind} ${object.id}`);
  addRow(context, STEP, { check: 'Objects of earlier runs', expected: 'none', measured: listed.length === 0 ? 'none' : listed.join(', ') });
  if (listed.length > 0) throw new Error(`Objects of earlier runs exist: ${listed.join(', ')}. Run the probe with --steps cleanup to delete them.`);
  return 'no object of an earlier run exists';
}

async function preflight(context: ProbeContext): Promise<string> {
  const parts: string[] = [];
  const { inputs, secrets } = context;
  if (usesStripe(inputs) && secrets.priceId !== undefined) parts.push(await readPriceAndMeter(context, secrets.priceId));
  if (inputs.steps.includes('checkout') && !inputs.workosOnly) parts.push(await readCheckoutSettings(context));
  if (inputs.steps.includes('webhook') && !inputs.workosOnly) parts.push(await readCli(context));
  parts.push(await noEarlierObjects(context));
  return `${parts.join('; ')}.`;
}

export function preflightPlan(inputs: ProbeInputs, values: Placeholders): readonly PlannedCall[] {
  const stripe = usesStripe(inputs) ? [
    planned(priceCall(values.priceId), 'A metered monthly USD price, per unit with a whole-cent unit_amount, on a meter. Its meter becomes {meterId}.'),
    planned(meterCall(values.meterId), `event_name ${EXPECTED_METER.event_name}, default_aggregation last, status active. The meter event of the test clock step uses its payload keys.`),
  ] : [];
  const checkout = inputs.steps.includes('checkout') && !inputs.workosOnly ? [
    planned(taxSettingsCall(), 'status active: Checkout with automatic tax needs it.'),
    planned(defaultPortalCall(), 'Cancellation at the period end, and no quantity update.'),
  ] : [];
  const cli = inputs.steps.includes('webhook') && !inputs.workosOnly ? [
    action('$ stripe --version', 'The Stripe CLI must be installed; the report gives its version.'),
    action('$ stripe listen --print-secret', 'The CLI must be signed in. Its output is the signing secret, <set>: it stays in memory and is never printed.'),
  ] : [];
  return [...stripe, ...checkout, ...cli, ...earlierObjectsPlan(systemsOf(inputs)).map((call) => ({ ...call, note: `${call.note} None may exist.` }))];
}

export { preflight };
