# Paid billing design

**Status: no payment provider is selected.** On 2026-10-12, the owner deferred
the choice of provider and the other paid billing decisions. Billing is a
separate object behind the [`Billing` interface](#the-billing-interface).
[`BillingFree`](#free-billing) is its only implementation. It bills no
organization and collects no payment. The paid product still needs
[AUTH-11](#auth-11-implementation-specification). Until AUTH-11 passes its
paid gates, no release collects payments.

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

## Owner decision

AUTH-10 asked the owner to decide D1 to D11 below. The owner answered on
2026-10-12:

> We haven't decided on billing provider yet. Make sure Billing is a seperate
> object (interface) and for now implement BillingFree object that basically
> doesn't bill anyone but answers the required interface (and can be later
> replaced easily by Stripe)

These rules follow from the answer:

- No payment provider is selected, and D1 stays open. The owner names Stripe
  as a possible later replacement. This is not a provider decision.
- D2 to D11 stay open. They apply only to paid billing, so they wait for the
  provider decision. Their recommendations stay as proposals.
- Billing is a separate object. Hosted code that needs billing uses the
  `Billing` interface. Only a `Billing` implementation calls a payment provider
  or reads billing storage.
- `BillingFree` is the implementation until AUTH-11 replaces it. It bills no
  organization.
- While `BillingFree` is in use, billing never changes access. Product portal
  and MCP access depend only on grants. D8 decides the rule for paid billing.

## The Billing interface

`src/billing/billing.ts` contains the contract. It has two operations. Each
operation gives a `BillingState`.

| Operation | Contract |
| --- | --- |
| `stateOf(organizationId)` | Gives the confirmed billing state of one organization. |
| `updateSeats(organizationId, seatCount)` | Gets the complete current count of active User seats. The count is never a change to add or subtract, so the same count again has no further effect. Gives the confirmed state after the update. |

`BillingState` has `organizationId`, `plan`, and `billedSeats`, the number of
seats that are billed. The only plan now is `free`. AUTH-11 adds the paid
states that the approved rules need.

Each implementation obeys these rules:

1. **One organization.** Each call names one organization. An empty or missing
   organization ID gives a `TypeError`. A state belongs only to its
   organization.
2. **Complete count.** The seat count is a whole number from 0 to
   `Number.MAX_SAFE_INTEGER`. Any other value gives a `RangeError`. The caller
   gets the count from all membership pages. If one page fails, the caller
   does not call `updateSeats`.
3. **Confirmed results.** A resolved call gives only a confirmed state. A
   rejected call confirms nothing, and the caller must not show the change as
   done. An operation refuses input with a rejected promise, never with a
   synchronous throw.
4. **Frozen records.** Each state is a frozen record.
5. **No role check.** `Billing` does not check roles. Before a customer billing
   change, the application service checks Super Admin authority and completed
   MFA, and it writes the change record. A seat update follows a membership
   change, so it does not need Super Admin.
6. **Hosted only.** The hosted composition creates one `Billing` when it serves
   a billing operation. The self-hosted composition creates none.

No production code calls `Billing` yet, because the membership changes and the
account pages do not exist yet. The hosted composition exists only as the
AUTH-12 [hosted placeholder](authentication-design.md#hosted-placeholder): it
serves no billing operation, gives each billing request the
authentication-unavailable answer, and creates no `Billing`. AUTH-11 connects
each caller that does not use `Billing` at that time.

## Free billing

`src/billing/billing-free.ts` contains `BillingFree`. It obeys the interface
rules and these rules:

- Each organization is on the free plan, with 0 billed seats, from its
  creation. There is no checkout, payment method, invoice, charge, credit,
  refund, renewal, or cancellation.
- `updateSeats` checks the count and changes nothing.
- `BillingFree` keeps no state and makes no external call. It needs no
  storage, settings, or provider account.

In these examples, `org-a` and `org-b` are hosted organizations.

| Case | Example | Result |
| --- | --- | --- |
| First purchase | An operator creates `org-a`. Its Super Admin grants Admin and then User to itself. The account page reads the billing state. | `stateOf("org-a")` gives `{ organizationId: "org-a", plan: "free", billedSeats: 0 }`. There is nothing to buy. MCP access depends only on the User grant. |
| Added seat | `org-a` has 4 active Users. An Admin grants User to a fifth person, and the app gives the count 5. | `updateSeats("org-a", 5)` gives the free state with 0 billed seats. There is no charge. |
| Removed seats | The count goes from 5 to 4, and then to 0. | Each update gives the free state. There is no credit. The last removal ends nothing. |
| Proration and cancellation | Seats change during a month, or a Super Admin wants to stop paying. | There is nothing to prorate or cancel. |
| Payment failure and unpaid states | A payment fails. | This cannot occur, because no payment is collected. |
| Duplicate and older counts | The count 5 arrives two times. Then an older count, 3, arrives. | Each update gives the same free state. |
| Other organization | `org-a` gets the count 7. At the same time, `org-b` reads its state. | `org-b` gets its own free state. |
| Invalid input | The app gives the count -1, or an empty organization ID. | The call rejects with a `RangeError` or a `TypeError`. It confirms nothing, and the state stays free. |
| Unknown outcome | A network or provider failure occurs. | `BillingFree` makes no external call. Only invalid input can make a call fail. |
| Reconciliation drift | A change outside the app changes the count. | There is no billed quantity, so it cannot drift. |
| Recovery | A call was refused. | The caller corrects its input. There is nothing else to recover. |

The [acceptance tests](../../test/acceptance/billing/free-billing.test.ts) and
the [unit tests](../../test/unit/billing/billing-free.test.ts) check these
examples. No test covers paid billing yet.

## Facts for the open paid decisions

Checked on 2026-10-12. Fees are approximate; check the provider price pages.

- **WorkOS.** An organization can keep a Stripe customer ID. The WorkOS Stripe
  Seat Sync add-on counts all active members and sends that count to Stripe as
  meter events. It does not exclude Admin-only or Super-Admin-only members, so
  it does not match the accepted count. With each provider, Thermus must
  calculate the count and send it.
  [WorkOS Stripe add-on](https://workos.com/docs/authkit/add-ons/stripe)
- **Stripe Billing.** Thermus is the seller. A subscription item has a seat
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
  tax; Thermus registers and files. Fees: about 2.9% + 0.30 USD for each US
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

## Open paid decisions

The owner deferred these decisions on 2026-10-12. They apply only to paid
billing, and they wait for the provider decision. Each decision has options.
**Recommended** marks the proposal. The examples use a 30-day period and a
price of 10 USD for each seat. Day 0 is the purchase day, and the renewal is
on day 30. The real price and currency are provider settings, not code.

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

While `BillingFree` is in use, billing never changes access, as in (b). The
reason code `subscription-required` does not exist.

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

The first hosted release has no payments, because it uses `BillingFree`. Its
organizations have no subscription when paid billing starts.

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

AUTH-08 keeps its change records in the operator log and adds no hosted
storage, so AUTH-11 chooses the storage. `BillingFree` needs no storage.

## Rules for every paid implementation

These rules follow from the accepted policy and the
[`Billing` interface](#the-billing-interface). They apply to each provider
option, and AUTH-11 keeps them.

1. **Provider-confirmed state.** `stateOf` and `updateSeats` give a status or
   quantity only after the provider confirms it in an API response or a
   verified event. A timeout, a network error, or a provider `5xx` response is
   an unknown outcome, not a success: the call rejects, and the app shows no
   change.
2. **Unknown outcomes.** After an unknown outcome, the app reads the current
   provider state before it tries again. Where the provider supports
   idempotency keys, each retry of one change uses the same key. A retry never
   makes a second subscription or charge.
3. **Absolute quantity.** `updateSeats` sets the billed quantity from the
   complete current count. It never adds or subtracts. The same update again
   has no further effect. An update applies even when its charge fails
   (Stripe `allow_incomplete`, Paddle `apply_change`), so reconciliation never
   repeats a charge.
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
   the app gives the complete count to `updateSeats`. When the count and the
   provider quantity differ, the update corrects the provider. The schedule
   also finds changes outside the app, such as accepted invitations and
   operator changes.
9. **No framework.** There is no event store or outbox framework.

## AUTH-11 implementation specification

AUTH-11 replaces `BillingFree` in the hosted composition with a provider
implementation of `Billing`. AUTH-11 is the only paid billing implementation
ticket. Do not create another one.

### Start conditions

- The owner chooses D1 and approves D2 to D11. This document then records the
  approved rules. It gives success, failure, and recovery examples for each
  case of the [free billing](#free-billing) table: first purchase, added and
  removed seats, proration, cancellation, unpaid states, unknown outcomes,
  duplicate events, reconciliation drift, and recovery.
- The hosted work of AUTH-06 to AUTH-08 is complete. AUTH-11 uses its hosted
  composition, account pages, change records, and complete count of active
  User seats.
- The AUTH-12 hosted placeholder does not meet the AUTH-06 condition. AUTH-06
  must replace the placeholder with the WorkOS provider and pass the
  [hosted live gate](../implementation/test-gate-policy.md#hosted-live-gate-auth-06).
  AUTH-07 and AUTH-08 can build their rules on the placeholder boundary with
  test doubles, but a pass of the offline placeholder tests is not a hosted
  gate pass.

### Steps

1. Write the failing acceptance specification,
   `test/acceptance/billing/paid-billing.test.ts`. It runs offline with a
   local double of the provider API. Its Given-When-Then scenarios cover:
   - the first purchase through the provider's hosted checkout, with a state
     that a verified event confirms;
   - added and removed seats, with the quantity that the provider confirms,
     the approved proration (D4), and the approved minimum (D5);
   - cancellation (D6), payment failure and unpaid states (D7 and D8), and
     recovery (D9);
   - an unknown outcome: after a provider timeout, the app shows no change. It
     reads the provider state before it tries again, and it makes no second
     subscription or charge;
   - a duplicate event, events in the wrong order, and events with a bad
     signature or an old time;
   - reconciliation drift: a change outside the app, such as an accepted
     invitation, and the scheduled correction;
   - authority: only a Super Admin with completed MFA starts or manages
     billing, and each change writes a change record;
   - the self-hosted edition, which has no billing routes.
2. Use focused TDD for each part that the specification needs. Write a failing
   unit test with doubles for the provider client, the storage, and the
   membership count. Then make it pass.
3. Connect each caller that does not use `Billing` yet. The membership and
   grant changes give the complete count to `updateSeats`. The account page
   reads `stateOf`. The hosted composition creates the provider
   implementation. If no approved rule still uses `BillingFree` after this
   change, remove it.
4. Pass the [paid gates](#paid-gates).

### Files and storage

The approved D1 and D11 decide the final names. The names below use the
recommended options.

| File | Change |
| --- | --- |
| `src/billing/billing.ts` | Add the paid states and the operations that the approved rules need, for example the hosted payment pages. `BillingFree` answers each new operation while it exists. |
| `src/billing/billing-<provider>.ts` | The provider implementation, for example `BillingStripe` in `billing-stripe.ts` for D1 (a). |
| `src/billing/billing-events.ts` | The event route. It checks the signature and the time on the raw body, and it records the IDs of processed events. |
| `src/billing/seat-reconciliation.ts` | Gives the complete count to `updateSeats` after each membership change and on a schedule. |
| `src/billing/billing-store.ts`, `migrations/billing/0001-billing.sql` | For D11 (a): SQLite through `node:sqlite` on the hosted persistent volume. The store keeps the provider customer and subscription IDs, the last confirmed status, quantity, and period end of each organization, the IDs of processed events, and the billing change records. For D11 (b), a PostgreSQL store replaces these files. |
| `src/hosted-admin/account-routes.ts`, `src/hosted-admin/account-pages.ts` | The Super Admin billing page and actions, with CSRF and origin checks. |
| `src/application.ts` | The hosted composition creates the provider implementation instead of `BillingFree`. |
| `src/config/deployment-config.ts`, `.env.example` | The provider settings of the hosted edition. The self-hosted edition reads none. |
| `package.json`, `pnpm-lock.yaml` | An exact pin of the provider SDK, if AUTH-11 uses one. |

### Tests

| Test file | Coverage |
| --- | --- |
| `test/unit/billing/billing-<provider>.test.ts` | Confirmed states, absolute quantity, idempotency keys, unknown outcomes, and the D5 minimum, with a double for the provider client. |
| `test/unit/billing/billing-events.test.ts` | Signature and time checks, duplicate event IDs, and event order. |
| `test/unit/billing/seat-reconciliation.test.ts` | Drift correction, a failed membership page, and a failed provider update. |
| `test/unit/billing/billing-store.test.ts` | Stored records and the IDs of processed events. |
| `test/integration/billing/paid-billing.test.ts` | The provider implementation, the event route, the store, and reconciliation together, with a local double of the provider API. |
| `test/acceptance/billing/paid-billing.test.ts` | The paid scenarios of step 1, offline. |
| `test/interface/billing/<provider>.live.ts` | A few provider contract checks in the provider sandbox: quantity updates, proration settings, quantity 0, idempotency keys, the signature format, and renewals and retries without a wait, for example with Stripe test clocks. |
| `test/acceptance/billing/paid-billing.live.ts` | The paid scenarios in the provider sandbox. |

The two `.live.ts` files need sandbox credentials. A dedicated command runs
them. Their names do not match the `*.test.js` globs, so `npm test` does not
select them.

### Paid gates

The hosted edition can collect payments only after each gate passes on the
complete candidate:

- `npm run check`, habit-hooks, `npm run test:integration`, and
  `npm run test:acceptance`;
- the dedicated live command, with sandbox credentials, where every live test
  passes. The [test gate policy](../implementation/test-gate-policy.md#paid-billing-gate-auth-11)
  gives the rules for this gate.

The free billing tests are not a paid gate. Until the paid gates pass, the
hosted edition keeps `BillingFree`, and no release collects payments.
