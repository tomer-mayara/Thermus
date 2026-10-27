import type Stripe from 'stripe';
import { objectName, PREFIX, probeEmail, probeMetadata } from './context.ts';

// The parameters of the Stripe writes. The dry run prints them with placeholders, and real mode sends them.
// Checkout returns the browser to example.com, a page with no Thermus code: the probe reads the session from Stripe.
const RETURN_URL = 'https://example.com/thermus-spike/checkout-return?session_id={CHECKOUT_SESSION_ID}';
// Stripe allows 30 minutes to 24 hours. One more minute keeps the value valid when this clock is a little ahead.
export const CHECKOUT_LIFETIME_S = 31 * 60;
// The test card 4000 0000 0000 0341: it attaches to a customer, but each charge fails (Stripe testing page).
export const FAILING_PAYMENT_METHOD = 'pm_card_chargeCustomerFail';
export const CLOCK_SEATS = 3;

// The meter fields that a meter event needs. The preflight reads them from the meter of the price.
export type MeterKeys = Pick<Stripe.Billing.Meter, 'event_name' | 'customer_mapping' | 'value_settings'>;

// The names that the "User Seat Count" meter of WorkOS is expected to have. The dry run shows them; real mode uses
// the names of the meter that the preflight reads.
export const EXPECTED_METER: MeterKeys = {
  event_name: 'workos_seat_count',
  customer_mapping: { event_payload_key: 'stripe_customer_id', type: 'by_id' },
  value_settings: { event_payload_key: 'value' },
};

export function customerParams(run: string, role: string, metadata: Record<string, string> = {}): Stripe.CustomerCreateParams {
  return { name: objectName(run, role), email: probeEmail(run, role), metadata: { ...probeMetadata(run), ...metadata } };
}

export interface CheckoutInputs {
  readonly priceId: string;
  readonly customer: string;
  // Unix seconds.
  readonly expiresAt: number;
}

export function checkoutParams(run: string, inputs: CheckoutInputs): Stripe.Checkout.SessionCreateParams {
  const { priceId, customer, expiresAt } = inputs;
  return {
    mode: 'subscription',
    customer,
    line_items: [{ price: priceId }],
    consent_collection: { terms_of_service: 'required' },
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    client_reference_id: `${PREFIX}${run}`,
    metadata: probeMetadata(run),
    subscription_data: { metadata: probeMetadata(run) },
    success_url: RETURN_URL,
    expires_at: expiresAt,
  };
}

export function clockParams(run: string, frozenTime: number): Stripe.TestHelpers.TestClockCreateParams {
  return { frozen_time: frozenTime, name: objectName(run, 'test-clock') };
}

export function clockSubscriptionParams(run: string, customer: string, priceId: string): Stripe.SubscriptionCreateParams {
  return { customer, items: [{ price: priceId }], metadata: probeMetadata(run) };
}

export interface SeatEventInputs {
  readonly run: string;
  readonly customer: string;
  // Unix seconds, inside the first period of the test clock subscription.
  readonly timestamp: number;
}

export function seatEventParams(meter: MeterKeys, inputs: SeatEventInputs): Stripe.Billing.MeterEventCreateParams {
  const { run, customer, timestamp } = inputs;
  return {
    event_name: meter.event_name,
    payload: { [meter.customer_mapping.event_payload_key]: customer, [meter.value_settings.event_payload_key]: String(CLOCK_SEATS) },
    identifier: `${PREFIX}${run}-test-clock-seats`,
    timestamp,
  };
}
