# Free and team tiers, with a price for each member through Stripe

Date: 26 October 2026. The owner made these decisions on that date, in the
answers of section 5 of the
[self on-boarding plan](../../docs/implementation/self-onboarding-plan.md)
([PR #259](https://github.com/tomer-mayara/Thermus/pull/259)). This record
keeps the tier rules of plan section 4.4 and the answers D-3, D-4, D-5, D-8,
D-10, D-11, and D-13. The
[container record](2026-10-26-per-tenant-containers.md) keeps the other
answers: D-1 one public origin, D-2 the free instance, D-6 the cost caps, and
D-7 the image source. It also keeps D-9 Render Hobby, D-12 the team instance,
D-14 no credential in a tenant, and D-15 the capacity of 10 calls. This record
changes no code. Tickets SO-08 and SO-13 to SO-15 of the plan implement it.

## Context

- `BillingFree` is the only implementation of the `Billing` interface. It
  bills no organization. Its plan is always `free`, and the billing page has
  no form.
- On 12 October 2026, the owner deferred the paid decisions D1 to D11 of the
  [billing design](../../docs/design/billing-design.md). Its AUTH-11 ticket is
  the only paid billing ticket. It requires a Super Admin with completed MFA.
- Since S1-02, an organization has two roles. User gives product access. Admin
  also gives member management and `billing:manage`, with no MFA.
- An invitation is a native WorkOS invitation. A person accepts it in AuthKit,
  outside the application, so the application cannot refuse the acceptance.
- WorkOS keeps a Stripe customer ID for each organization. Its Stripe add-on,
  Seat Sync, sends the active member count to a Stripe meter at each
  membership change. Organization metadata is full.

## Decision

The tiers are `free` and `team`. Each organization starts as `free`: signup
takes `?tier=free`, and only an upgrade gives `team`. The tier rules of
26 October 2026:

| Rule | `free` | `team` |
| --- | --- | --- |
| Members | At most 5 in total, the creator included: active memberships with product access plus pending invitations. Expired invitations do not count. Beyond the limit, an invitation gets `limit-reached` with an Upgrade link. | No limit. Each active member is billed. |
| Enforcement | At invitation send, in `OrganizationAdministration.sendInvitation()` on the control plane, from complete member and invitation reads. Serialized for each organization. A failed page fails the check. | None. |
| Invariant | An invitation from the control plane is the only way to add a member. SSO, Directory Sync, domain joining, and dashboard-created memberships stay off. | The same. |
| Inviting again after a downgrade | Needs member removal or a new upgrade. | Not applicable. |
| Container | `0.5c-512mb` (D-2), suspended when idle (D-6). | `1c-2g` (D-12), never suspended. |
| Capacity | 10 calls at a time (D-15). | The same, with more memory. |
| Portal | `plan: 'free'`, `memberLimit: 5`. | `plan: 'team'`. |

The application cannot refuse an acceptance, so a pending invitation reserves
its seat at send time. Rejected: a check at acceptance, which is not possible.

The billing answers of 26 October 2026:

- **Price for each active member (D-3).** WorkOS Seat Sync sends the count to
  a Stripe meter, and a metered Stripe price bills the last count of each
  monthly period. The upgrade writes the Stripe customer ID to the WorkOS
  `stripe_customer_id` field. No Thermus code counts billed seats or sets a
  quantity, and `updateSeats()` stays unused. Rejected: a seat quantity that
  Thermus sets.
- **Price settings (D-4).** The amount is set later in Stripe; the code reads
  only the price ID. USD, no trial, and Stripe Tax on, with address and tax ID
  collection. The price on `thermus.ai` must match the Stripe price before
  signup opens.
- **Stripe (D-13).** Stripe Checkout starts the subscription, with required
  acceptance of the paid terms. Card data never reaches Thermus. The Stripe
  Customer Portal gives the payment method, invoices, and cancellation at the
  period end, with no quantity change. The organization is `team` as soon as
  Checkout returns. Signed webhooks and a daily reconciliation then apply the
  status. Only an Admin with `billing:manage` starts or manages billing, and a
  second subscription is refused while one runs. Rejected: Paddle Billing and
  Stripe Managed Payments.
- **State in PostgreSQL (D-8).** A `subscriptions` table in the existing
  Supabase PostgreSQL project, on Supabase Free for now, keeps the last state
  that Stripe confirmed. The tier is derived: `team` for `active`, `trialing`,
  and `past_due`, and `free` for all other cases, also with no row. Stripe is
  the authority for the status, and WorkOS for the member count. Rejected:
  SQLite on a persistent volume, and WorkOS metadata.
- **The 5-member rule (D-5).** At 5 members, a free organization cannot add
  more. A team organization returns to `free` at the end of its paid period or
  of the Stripe retries. Its members keep access. Pending invitations above the
  limit are revoked, and new invitations are refused at 5 or more. Accepted
  consequence: an organization keeps the members that it added while it paid,
  and it paid for each of them for at least one month. Rejected: an access
  denial above the limit.
- **Existing organizations (D-10).** A fresh inventory deletes the unused
  test organizations. The others start as `free`.
- **Legal and marketing (D-11).** They follow the existing document process.

This closes D1 to D11 of the billing design: D1 Stripe; D2 monthly, billed at
the end of each period from the meter; D3 automatic charge; D4 no proration,
because the meter bills the last count of the period; D5 zero members bill
zero; D6 cancellation at the period end through the Customer Portal; D7 access
stays during the Stripe retries; D8 becomes "no subscription means the free
tier"; D9 a new Checkout starts again; D10 every existing organization starts
as `free`; D11 PostgreSQL.

SO-13 of the plan is AUTH-11. The S1-02 model, an Admin with `billing:manage`
and no MFA, supersedes the AUTH-11 precondition "Super Admin with completed
MFA". SO-13 records these decisions in the billing design.

## Consequences

- The D-5 loophole is accepted. An organization can upgrade, add members, and
  downgrade, and it keeps those members on the free tier.
- Billing never denies product access. The tier sets only the member limit and
  the container plan.
- Legal work comes first. The approved Terms say that the hosted service is
  free. Paid Terms of Service and a Privacy Policy that names Stripe need the
  next unused version label and new hashes. They also need owner approval,
  publication on `thermus.ai`, and a new runtime bundle. No customer reaches
  Checkout before that (SO-14).
- The WorkOS Stripe add-on is a dashboard dependency. The owner connects it in
  each WorkOS environment. WorkOS does not support a Stripe Sandbox account, so
  tests use the standard account in test mode.
- The Seat Sync count includes memberships with only the default role, which
  give no product access. They do not occur in normal use, and the daily fleet
  summary reports one.
- Thermus is the seller. Stripe Tax calculates and collects the tax; Thermus
  registers and files.
