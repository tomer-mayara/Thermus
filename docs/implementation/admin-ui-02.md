# UI-02 — Member rows and quiet removal

Scope: [UI-02](../design/organization-admin-plan.md#ui-02--member-rows-and-quiet-removal)
of the Refined tabs plan. This work is stacked on
[UI-01, PR #263](https://github.com/tomer-mayara/Thermus/pull/263), at
`a017020ebe2448f5de6cc7d9cbb0700367fc80b1`.
Implementation and validation are in progress. This record claims no merge or
deployment.

## Required behavior

Show labelled Member, Role and Action facts in aligned rows. The heading counts
the complete active member rows. Retain the separate product-access count.
Keep absent and unknown roles visible and read-only.

Use the trusted subject for You and Leave. Other removable members get Remove.
Use native disclosures and quiet initial actions. Only the final removal or
leave confirmation is red. Preserve names, consequences, Cancel, protected form
fields, server safeguards, recovery outcomes and the exact approved help.

UI-03 invitation disclosure and UI-04 pending-invitation changes remain separate
work. This increment needs no new provider read, permission rule or script.

## BDD, TDD and validation

Run the new row-count, labelled-facts and self-action acceptance checks before
source changes. Use focused integration and browser red/green steps for trusted
identity, escaping, row geometry and action emphasis. Retain passing
characterization of unchanged refusal, recovery and account-preservation rules.

The complete candidate needs the ordinary suite, typecheck, portal build,
Members browser, self-hosted container, hosted offline build and Linux AMD64
image gates. Trace changed test helpers to all consuming groups. Root review
owns complete-candidate quality, architecture assessment and PR evidence.
