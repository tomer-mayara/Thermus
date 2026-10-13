# Paid billing design

**Status: proposed. Waiting for owner decisions.** No payment provider is
selected. No billing code exists. This document lists the open AUTH-10
decisions, with options and a recommendation for each. After the owner
decides, AUTH-10 records the approved rules and examples here, updates the
[authentication plan](authentication-design.md), and specifies the AUTH-11
implementation. Until AUTH-11 passes its paid gates, no release collects
payments.

## Accepted policy

The decisions below do not change these rules.

- Only the hosted edition has billing. The self-hosted edition has no billing
  routes, storage, or provider calls.
- In each organization, only Super Admin manages billing. No other grant gives
  billing authority.
- A billing change by a customer needs completed MFA and a basic change record:
  actor, organization, target, action, time, and outcome, without credentials.
- The count of seats is the number of unique active memberships with User in
  the organization. User plus Admin or Super Admin counts once. Admin-only and
  Super-Admin-only memberships, pending invitations, and inactive memberships
  do not count.
- WorkOS memberships are the authority for this count. If one membership page
  fails, the count fails. The app never uses a partial count.

## Facts that affect the decisions

Checked on 2026-10-12. Fees are approximate; check the provider price pages.

- **WorkOS.** An organization can keep a Stripe customer ID. The WorkOS Stripe
  Seat Sync add-on counts all active members and sends that count to Stripe as
  meter events. It does not exclude Admin-only or Super-Admin-only members, so
  it does not match the accepted count. With each provider, Magumagu must
  calculate the count and send it.
  [WorkOS Stripe add-on](https://workos.com/docs/authkit/add-ons/stripe)
- **Stripe Billing.** Magumagu is the seller. A subscription item has a seat
  quantity. A quantity change can put prorations on the next invoice
  (`create_prorations`), invoice them at once (`always_invoice`), or make no
  prorations (`none`). By default, a change applies even when its payment
  fails. Pending updates (`payment_behavior=pending_if_incomplete`) can hold a
  change that is invoiced at once until its payment succeeds. Smart Retries
  retry a failed payment; the recommended setting is 8 tries in 2 weeks, and
  the window can be 1 week to 2 months. After the last failed retry, Stripe
  can cancel, mark unpaid, leave past due, or pause the subscription. Test
  clocks move a sandbox subscription through time, so automated tests can
  cover renewals, prorations, and retries. Stripe Tax can calculate and collect
  tax; Magumagu registers and files. Fees: about 2.9% + 0.30 USD for each US
  card payment, 0.7% for Billing, and 0.5% for Tax. A proof must show if a
  quantity of 0 is accepted.
  [Quantities](https://docs.stripe.com/billing/subscriptions/quantities),
  [pending updates](https://docs.stripe.com/billing/subscriptions/pending-updates),
  [retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries),
  [test clocks](https://docs.stripe.com/billing/testing/test-clocks)
- **Paddle Billing.** Paddle is the merchant of record. It sells to the
  customer and handles sales tax, VAT, invoices, and chargebacks. A quantity
  change uses one of five modes: `prorated_immediately`,
  `prorated_next_billing_period`, `full_immediately`,
  `full_next_billing_period`, or `do_not_bill`. The minimum quantity is 1.
  Paddle refuses updates to a `past_due` subscription. While a cancellation is
  scheduled, a change must use `prorated_immediately`, `full_immediately`, or
  `do_not_bill`. By default (`on_payment_failure=prevent_change`), a change
  does not apply when its payment fails. Paddle retries a failed renewal up to
  seven times in 30 days and then cancels the subscription. The sandbox can
  send simulated events. A proof must show how tests can cover renewals and
  retries without a wait. Fee: about 5% + 0.50 USD for each payment.
  [Update a subscription](https://developer.paddle.com/api-reference/subscriptions/update-subscription),
  [changes with a scheduled change](https://developer.paddle.com/changelog/2025/update-subscriptions-scheduled-change/),
  [payment recovery](https://developer.paddle.com/changelog/2025/default-dunning-payment-recovery)
- **Stripe Managed Payments.** Stripe is the merchant of record for Checkout
  Sessions and Payment Links, from API version `2026-04-22.dahlia`. It handles
  indirect tax in more than 80 countries and adds a fee of about 3.5%. It is
  new, and support for later seat changes is not proven for this product.
  [Changelog](https://docs.stripe.com/changelog/dahlia/2026-04-22/managed-payments)
- **Events.** Stripe signs each event with HMAC-SHA256 in the
  `Stripe-Signature` header; Paddle uses the `Paddle-Signature` header. Stripe
  retries a failed delivery for up to three days. An event can arrive more than
  one time and in any order.
  [Stripe webhooks](https://docs.stripe.com/webhooks)

## Decisions for the owner

Each decision has options. **Recommended** marks the proposal. The examples
use a 30-day period and a price of 10 USD for each seat. Day 0 is the purchase
day, and the renewal is on day 30. The real price and currency are provider
settings, not code.

### D1. Payment provider

- **(a) Stripe Billing. Recommended.**
- (b) Paddle Billing as merchant of record.
- (c) Stripe Managed Payments as merchant of record.
- (d) Another provider that the owner names.

Stripe accepts seat changes while a payment is past due or a cancellation is
scheduled, and its test clocks let automated tests cover renewals,
prorations, and retries. WorkOS can keep the Stripe customer ID. Paddle
refuses seat changes while a payment is past due, needs at least 1 seat, and
restricts billing modes while a cancellation is scheduled. Choose (b) if the
provider must carry the sales tax and VAT duties.

If you choose (a), also say if Stripe Tax is on. With Stripe Tax, checkout
collects the customer address and, for a business, its tax ID.

### D2. Billing period

- **(a) Monthly, paid in advance. Recommended.** The period starts on the
  purchase day. There is one price for each seat and no free trial.
- (b) Monthly or yearly. The Super Admin selects one at purchase.
- (c) Yearly only.

Example for (a): a Super Admin buys on day 0 with 3 active Users. The provider
charges 30 USD on day 0. If the count does not change, it charges 30 USD on
day 30.

### D3. Payment collection

- **(a) Automatic charge only. Recommended.** The Super Admin gives a payment
  method on the provider's hosted page. The provider charges it at each
  renewal.
- (b) Also invoices with payment terms, for example 30 days, for selected
  organizations. The payment-failure rules in D7 then need a separate rule for
  late invoices.

### D4. Seat changes

The count increases when an active membership gets User, or when a membership
with User becomes active, for example after an accepted invitation. The count
decreases when a membership loses User or becomes inactive. Each option
applies to both directions, so a seat that is free to add cannot earn a credit.

- **(a) Prorate both directions on the next invoice. Recommended.** A new
  User has access at once, and no payment is necessary before the grant. A
  removed seat gets a credit for the unused days. A seat that is removed and
  added again in one period is paid one time.
- (b) Charge added seats at once, and credit removed seats on the next
  invoice. The change applies even when the charge fails, and the open invoice
  follows D7.
- (c) Prorate added seats on the next invoice. Give no credit for removed
  seats; the lower count applies from the next period.
- (d) No proration in either direction. Each change applies from the next
  period. An added seat is free until then.

Example: 4 seats are paid. On day 10, an Admin grants User to a fifth person.
On day 20, one User grant is removed. Each next invoice includes 40 USD for 4
seats in the next period.

| Option | Day 10 | Next invoice |
| --- | --- | --- |
| (a) | Nothing | 40 + 6.67 - 3.33 = 43.34 USD |
| (b) | Charge of 6.67 USD | 40 - 3.33 = 36.67 USD |
| (c) | Nothing | 40 + 6.67 = 46.67 USD |
| (d) | Nothing | 40 USD |

With a yearly period (D2 b or c), (a) and (c) delay the charge for an added
seat by up to 12 months. Choose (b) for yearly periods.

### D5. Zero active Users

- **(a) Bill at least 1 seat. Recommended.** The count rule does not change;
  only the billed quantity has a minimum of 1. This works with each provider.
- (b) Bill the real count, also 0. A subscription can start only with at
  least one active User. This needs a provider that accepts a quantity of 0;
  Paddle does not.

Example for (a): an organization removes its last User on day 5. The next
invoice bills 1 seat until a Super Admin cancels.

### D6. A Super Admin cancels

- **(a) Cancel at the end of the period. Recommended.** There is no refund.
  Users keep access until the period ends. A Super Admin can undo the
  cancellation before then. Seat changes after the cancellation request are
  neither billed nor credited.
- (b) Cancel at once with a prorated refund. Paid access stops at once.

Example for (a): a Super Admin cancels on day 12. Users work until day 30.
There is no renewal charge, and D8 applies from day 30. If a Super Admin undoes
the cancellation on day 20, the renewal occurs on day 30.

### D7. A payment fails

- **(a) Users keep access while the provider retries. Recommended.** The
  account page shows the failure to Super Admins, with a link to the
  provider's hosted payment page. The retry window is 2 weeks with Stripe, or
  the 30-day Paddle default. After the last failed retry, the subscription
  ends, and D8 applies.
- (b) Paid access stops at the first failed payment. It returns when a retry
  or a new payment method succeeds. After the last failed retry, the
  subscription ends.

Example for (a) with Stripe: the renewal on day 30 fails. Users keep working.
A retry on day 33 succeeds, and the subscription is active again. If the last
retry fails on day 44, paid access ends.

With (a), the days of grace are not paid if the subscription ends. D9 decides
if a later subscription must pay them.

### D8. Access without a paid subscription

This applies before the first purchase, after a cancellation ends, and after
the last failed retry.

- **(a) Deny product access. Recommended.** Product portal and MCP requests in
  that organization get the access-denied response with a new safe reason
  code, `subscription-required`. The administration portal stays available to
  Admin and Super Admin. Billing state never removes grants or memberships.
- (b) Billing state never changes access. Access depends only on grants. D7
  and D10 then do not change access.

Example for (a): an operator creates an organization. Its Super Admin grants
Admin and then User to itself. Its MCP requests get `subscription-required`
until a Super Admin completes the first payment.

### D9. Recovery

During the retry window, a Super Admin updates the payment method on the
provider's hosted page, and the provider pays the open invoice. The options
below apply after the subscription ends.

- **(a) Start again. Recommended.** A Super Admin starts a new subscription at
  the current count. Access returns when the provider confirms the payment.
  The app does not collect the old unpaid invoice, so the days of grace stay
  unpaid. A customer can repeat this.
- (b) Pay, then start again. A Super Admin must pay the old open invoice on
  the provider's hosted page before a new subscription can start.
- (c) Stripe only: after the last failed retry, Stripe marks the subscription
  unpaid instead of ending it. Access returns when a Super Admin pays the most
  recent invoice. Stripe makes draft invoices while the subscription is
  unpaid.

### D10. Organizations from before billing

The first hosted release has no payments. Its organizations have no
subscription when billing starts.

- **(a) Announce a start date. Recommended.** From that date, D8 applies to
  each organization. For an internal or demonstration organization, the
  operator gives a subscription with a 100% discount in the provider. The app
  needs no exemption.
- (b) Add an operator exemption list to the app. This needs a new operator
  setting and storage.
- (c) Apply D8 on the release day, with no notice.

### D11. Hosted operation

Billing needs durable hosted storage: for each organization, the provider
customer and subscription IDs and the last provider-confirmed status,
quantity, and period end; the IDs of processed provider events; and billing
change records. The hosted design has no storage or persistent volume now. The
provider and WorkOS stay the authorities, so reconciliation can rebuild the
subscription data from them. A design without app storage would add a provider
call to each protected request; it is not proposed.

- **(a) One hosted instance with a persistent volume. Recommended.** Billing
  uses SQLite through the built-in `node:sqlite` module, as the self-hosted
  edition does. There is no new package or service, and the tests stay
  offline. The hosted service cannot run more than one instance.
- (b) Several hosted instances with a managed PostgreSQL database. This needs
  a database service, a client package, and a test database.

If AUTH-07 or AUTH-08 gives change records hosted storage first, billing uses
the same storage.

## Rules for each option

These rules follow from the accepted policy. AUTH-10 completes them after the
decisions.

1. **Provider-confirmed state.** The app shows a status or quantity only after
   the provider confirms it in an API response or a verified event. A timeout,
   a network error, or a provider `5xx` response is an unknown outcome, not a
   success.
2. **Unknown outcomes.** After an unknown outcome, the app reads the current
   provider state before it tries again. Where the provider supports
   idempotency keys, each retry of one change uses the same key. A retry never
   makes a second subscription or charge.
3. **Absolute quantity.** An update sets the billed quantity from the current
   count. It never adds or subtracts. The same update again has no further
   effect. An update applies even when its charge fails (Stripe
   `allow_incomplete`, Paddle `apply_change`), so reconciliation never repeats
   a charge.
4. **One subscription for each organization.** The app does not start a
   checkout while the organization has a subscription that has not ended.
5. **Limited hosted pages.** The provider's hosted pages let a Super Admin
   update the payment method, see and pay invoices, and cancel. They do not let
   anyone change the quantity; the quantity always follows the count.
6. **Verified events.** The event route verifies the signature and its time on
   the raw body before it uses the event. An event that fails the check
   changes nothing.
7. **Duplicates and order.** A repeated event has no second effect. The app
   does not trust the event order. It reads the current provider object and
   applies that state.
8. **Reconciliation.** After each grant change in the app, and on a schedule,
   the app compares the count with the provider quantity. When they differ,
   the app corrects the provider. The schedule also finds changes outside the
   app, such as accepted invitations and operator changes.
9. **No framework.** There is no event store or outbox framework.

## Next steps after the decisions

1. Record the approved decisions here, with success, failure, and recovery
   examples for the initial purchase, seat changes, proration, cancellation,
   unpaid states, unknown outcomes, duplicate events, and reconciliation drift.
2. Update the requirements, slice 6, and the paid product section of the
   [authentication plan](authentication-design.md). State that the paid
   product still needs AUTH-11 until its gates pass.
3. Specify AUTH-11: a failing Given-When-Then acceptance specification first,
   then focused TDD, with concrete files and storage, provider contract and
   integration tests, dependencies, and the paid release gates in the
   [test gate policy](../implementation/test-gate-policy.md).
