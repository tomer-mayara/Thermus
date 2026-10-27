import type Stripe from 'stripe';
import { query } from './calls.ts';
import { PROBE_TAG } from './context.ts';
import type { StripeCall } from './stripe-client.ts';

export const PROBE_CUSTOMERS_QUERY = `metadata['thermus_probe']:'${PROBE_TAG}'`;

export function priceCall(id: string): StripeCall<Stripe.Price> {
  return { method: 'GET', path: `/v1/prices/${id}`, sdk: 'stripe.prices.retrieve', send: (stripe) => stripe.prices.retrieve(id) };
}

export function meterCall(id: string): StripeCall<Stripe.Billing.Meter> {
  return { method: 'GET', path: `/v1/billing/meters/${id}`, sdk: 'stripe.billing.meters.retrieve', send: (stripe) => stripe.billing.meters.retrieve(id) };
}

export function meterSummaryCall(meterId: string, params: Stripe.Billing.MeterListEventSummariesParams): StripeCall<Stripe.ApiList<Stripe.Billing.MeterEventSummary>> {
  const path = `/v1/billing/meters/${meterId}/event_summaries?${query({ customer: params.customer, start_time: params.start_time, end_time: params.end_time })}`;
  return { method: 'GET', path, sdk: 'stripe.billing.meters.listEventSummaries', params, send: (stripe) => stripe.billing.meters.listEventSummaries(meterId, params) };
}

export function meterEventCall(params: Stripe.Billing.MeterEventCreateParams): StripeCall<Stripe.Billing.MeterEvent> {
  return { method: 'POST', path: '/v1/billing/meter_events', sdk: 'stripe.billing.meterEvents.create', params, send: (stripe) => stripe.billing.meterEvents.create(params) };
}

export function defaultPortalCall(): StripeCall<Stripe.ApiList<Stripe.BillingPortal.Configuration>> {
  const params = { is_default: true, limit: 1 };
  return { method: 'GET', path: `/v1/billing_portal/configurations?${query(params)}`, sdk: 'stripe.billingPortal.configurations.list', params, send: (stripe) => stripe.billingPortal.configurations.list(params) };
}

export function taxSettingsCall(): StripeCall<Stripe.Tax.Settings> {
  return { method: 'GET', path: '/v1/tax/settings', sdk: 'stripe.tax.settings.retrieve', send: (stripe) => stripe.tax.settings.retrieve() };
}

// The search lags the writes by up to a minute (Stripe search documentation), so it finds the customers of earlier
// runs, and only the cleanup of this run needs the IDs that the steps remember.
export function customersSearchCall(searchQuery: string): StripeCall<Stripe.ApiSearchResult<Stripe.Customer>> {
  const params = { query: searchQuery, limit: 100 };
  return { method: 'GET', path: `/v1/customers/search?${query(params)}`, sdk: 'stripe.customers.search', params, send: (stripe) => stripe.customers.search(params) };
}

export function testClocksCall(): StripeCall<Stripe.ApiList<Stripe.TestHelpers.TestClock>> {
  const params = { limit: 100 };
  return { method: 'GET', path: `/v1/test_helpers/test_clocks?${query(params)}`, sdk: 'stripe.testHelpers.testClocks.list', params, send: (stripe) => stripe.testHelpers.testClocks.list(params) };
}

export function createCustomerCall(params: Stripe.CustomerCreateParams): StripeCall<Stripe.Customer> {
  return { method: 'POST', path: '/v1/customers', sdk: 'stripe.customers.create', params, send: (stripe) => stripe.customers.create(params) };
}

export function customerCall(id: string): StripeCall<Stripe.Customer | Stripe.DeletedCustomer> {
  return { method: 'GET', path: `/v1/customers/${id}`, sdk: 'stripe.customers.retrieve', send: (stripe) => stripe.customers.retrieve(id) };
}

export function setPaymentMethodCall(id: string, paymentMethod: string): StripeCall<Stripe.Customer> {
  const params = { invoice_settings: { default_payment_method: paymentMethod } };
  return { method: 'POST', path: `/v1/customers/${id}`, sdk: 'stripe.customers.update', params, send: (stripe) => stripe.customers.update(id, params) };
}

export function deleteCustomerCall(id: string): StripeCall<Stripe.DeletedCustomer> {
  return { method: 'DELETE', path: `/v1/customers/${id}`, sdk: 'stripe.customers.del', send: (stripe) => stripe.customers.del(id) };
}

export function attachPaymentMethodCall(paymentMethod: string, customer: string): StripeCall<Stripe.PaymentMethod> {
  const params = { customer };
  return { method: 'POST', path: `/v1/payment_methods/${paymentMethod}/attach`, sdk: 'stripe.paymentMethods.attach', params, send: (stripe) => stripe.paymentMethods.attach(paymentMethod, params) };
}

export function createCheckoutCall(params: Stripe.Checkout.SessionCreateParams): StripeCall<Stripe.Checkout.Session> {
  return { method: 'POST', path: '/v1/checkout/sessions', sdk: 'stripe.checkout.sessions.create', params, send: (stripe) => stripe.checkout.sessions.create(params) };
}

export function checkoutCall(id: string): StripeCall<Stripe.Checkout.Session> {
  const params = { expand: ['subscription'] };
  return { method: 'GET', path: `/v1/checkout/sessions/${id}?expand[]=subscription`, sdk: 'stripe.checkout.sessions.retrieve', params, send: (stripe) => stripe.checkout.sessions.retrieve(id, params) };
}

export function expireCheckoutCall(id: string): StripeCall<Stripe.Checkout.Session> {
  return { method: 'POST', path: `/v1/checkout/sessions/${id}/expire`, sdk: 'stripe.checkout.sessions.expire', send: (stripe) => stripe.checkout.sessions.expire(id) };
}

export function createSubscriptionCall(params: Stripe.SubscriptionCreateParams): StripeCall<Stripe.Subscription> {
  return { method: 'POST', path: '/v1/subscriptions', sdk: 'stripe.subscriptions.create', params, send: (stripe) => stripe.subscriptions.create(params) };
}

export function subscriptionCall(id: string): StripeCall<Stripe.Subscription> {
  return { method: 'GET', path: `/v1/subscriptions/${id}`, sdk: 'stripe.subscriptions.retrieve', send: (stripe) => stripe.subscriptions.retrieve(id) };
}

export function cancelSubscriptionCall(id: string): StripeCall<Stripe.Subscription> {
  return { method: 'DELETE', path: `/v1/subscriptions/${id}`, sdk: 'stripe.subscriptions.cancel', send: (stripe) => stripe.subscriptions.cancel(id) };
}

// A list of invoices omits the invoices of a test clock unless it names the subscription (test clock guide).
export function invoicesCall(subscription: string): StripeCall<Stripe.ApiList<Stripe.Invoice>> {
  const params = { subscription, limit: 10 };
  return { method: 'GET', path: `/v1/invoices?${query(params)}`, sdk: 'stripe.invoices.list', params, send: (stripe) => stripe.invoices.list(params) };
}

export function invoiceCall(id: string): StripeCall<Stripe.Invoice> {
  return { method: 'GET', path: `/v1/invoices/${id}`, sdk: 'stripe.invoices.retrieve', send: (stripe) => stripe.invoices.retrieve(id) };
}

export function createClockCall(params: Stripe.TestHelpers.TestClockCreateParams): StripeCall<Stripe.TestHelpers.TestClock> {
  return { method: 'POST', path: '/v1/test_helpers/test_clocks', sdk: 'stripe.testHelpers.testClocks.create', params, send: (stripe) => stripe.testHelpers.testClocks.create(params) };
}

export function advanceClockCall(id: string, frozenTime: number): StripeCall<Stripe.TestHelpers.TestClock> {
  const params = { frozen_time: frozenTime };
  return { method: 'POST', path: `/v1/test_helpers/test_clocks/${id}/advance`, sdk: 'stripe.testHelpers.testClocks.advance', params, send: (stripe) => stripe.testHelpers.testClocks.advance(id, params) };
}

export function clockCall(id: string): StripeCall<Stripe.TestHelpers.TestClock> {
  return { method: 'GET', path: `/v1/test_helpers/test_clocks/${id}`, sdk: 'stripe.testHelpers.testClocks.retrieve', send: (stripe) => stripe.testHelpers.testClocks.retrieve(id) };
}

export function deleteClockCall(id: string): StripeCall<Stripe.TestHelpers.DeletedTestClock> {
  return { method: 'DELETE', path: `/v1/test_helpers/test_clocks/${id}`, sdk: 'stripe.testHelpers.testClocks.del', send: (stripe) => stripe.testHelpers.testClocks.del(id) };
}
