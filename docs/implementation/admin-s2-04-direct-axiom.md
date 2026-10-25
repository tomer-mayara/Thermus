# S2-04 direct Axiom audit destination

## Current Admin form

The Admin chooses **Axiom** or **Custom**. Both choices use a full public HTTPS
OTLP logs URL and a Bearer token. Axiom requires a dataset; Custom omits it.
Switching the choice changes only the form until Save. Test still requires the
saved values, and it does not save edits or enable export.

The page keeps this warning, with a link to the Privacy Policy:

> Send organization data only if you have authority to do so. Check destination access and retention. Read our Privacy Policy.

The former long export explanation and authentication radio buttons are removed.
Terms, Privacy, stored agreements, capture rules, delivery limits, and backup
scope stay unchanged. The prior notice package remains an immutable record.

The saved format stays the same: a nonempty dataset selects Axiom on read; no
dataset selects Custom. No migration is needed. A saved Bearer token stays hidden
and can be retained with blank input only for the same endpoint. A changed
endpoint needs a new token. Existing None-auth settings remain readable and
unchanged until an Admin saves a Bearer token. Every form Save, including turning
export off, needs that upgrade. They must also be updated before using Test
through the new form. The underlying service and sender retain None support.

## Original PR #248 implementation record

The sections below record the earlier optional-dataset implementation and its
checks. The current form above supersedes its UI details; those earlier checks
do not validate this later form change.

The owner chose direct Axiom export because no Collector is running. This change
adds one optional dataset field to the existing Audit destination. It adds no
service, provider framework, environment variable, or arbitrary header map.

## Behavior

- The Admin form accepts a full HTTPS OTLP logs endpoint, optional Axiom dataset,
  authentication, and Enable export in one Save. The rollout destination is
  `https://us-east-1.aws.edge.axiom.co/v1/logs`, with dataset `audit-log-test`.
- A dataset has 1–128 ASCII letters, digits, or hyphens. This follows the
  [Axiom dataset contract](https://axiom.co/docs/reference/datasets). A blank
  field removes the dataset option. Duplicate form fields are refused.
- The service stores `axiomDataset` with the destination. The SQL adapter stores
  it as nullable `axiom_dataset`. A dataset change advances the saved revision;
  an unchanged value preserves it. Clearing the field restores generic OTLP
  behavior.
- Saved Test refuses unsaved dataset edits. Queue dispatch reads the current
  saved revision before each attempt. A dataset change invalidates old queued
  work. An event already sent cannot be recalled.
- The Audit sender emits `x-axiom-dataset` only for an explicit valid dataset.
  It uses the existing Bearer header and OTLP/HTTP JSON body. This follows the
  [Axiom OpenTelemetry contract](https://axiom.co/docs/send-data/opentelemetry).
  System logger settings and environment headers are not consulted.
- Token encryption, endpoint-bound token retention, trusted tenant selection,
  revision checks, public-address checks, verified TLS, zero redirects, bounded
  response handling, and cancellation remain in force. A dataset-only edit can
  retain the encrypted token when the endpoint and auth stay the same.

The UI identifies the dataset as optional, asks for a dataset-scoped token for
Axiom, and uses “Destination” in Test results. It also explains authority to
send organization data, redaction limits, destination access and retention, no
audit history or replay, no settings backup, and the need to check Test receipt.
The exact help text is included in the separate notice review.

## Migration and activation

Apply
[`20261024231921_add_logging_axiom_dataset.sql`](../../sql/migrations/20261024231921_add_logging_axiom_dataset.sql)
before activating the new SQL adapter. The migration only adds a nullable text
column. Existing rows remain generic destinations. Roles, grants, and RLS do
not change. The original applied migration is unchanged.

Supabase CLI 2.122.0 created the filename with `migration new` after command
discovery through `--help`. A temporary local YAML profile avoided a missing
user profile. That filename-creation step ran no remote database command. The generated filename was kept
when the file moved into the repository's `sql/migrations/` directory.
The manager later applied the reviewed migration to the selected project; see
the [rollout ledger](admin-s2-04.md#actual-sql-setup-and-local-application-proof--24-october-2026).

The earlier application can still read and write its original SQL columns, but
it cannot send the Axiom dataset header. Disable direct Axiom export before
rolling back to that application. The additive column need not be removed.

## Test evidence

The Admin acceptance test was written first. Its first run failed with `400`
instead of `303` because the form did not accept the dataset. Focused tests then
failed for settings projection, validation, SQL row mapping, and sender header
forwarding. After implementation, the tests passed. The new help acceptance
and unit tests also failed before the UI text changed, then passed.

- Focused ordinary tests: 206 passed, zero failures, skips, or todos. This covers
  all changed ordinary test files. It includes real service and queue
  collaboration: hold an in-flight event, queue old work, change only the
  dataset, then prove that only new-revision work reaches the sender.
- `pnpm run test:logging:postgres`: 13 passed, zero failures, skips, or todos.
  This uses disposable PostgreSQL 17 with verified TLS and the scoped role.
  It checks persistence across reconnect, dataset add/repeat/change/clear,
  revision conflicts, tenant selection, and bounded storage failure.
- `pnpm run test:logging:collector`: 10 passed, zero failures, skips, or todos.
  The gate checks real DNS, TLS, HTTP headers, saved Test, and the existing
  hosted audit journey. A local receiver verifies the Axiom header
  contract; it does not prove live Axiom ingestion or durable retention.

An early PostgreSQL run failed before the new column existed. A concurrent
clean build also removed later test outputs in that run; it was rerun with
exclusive build ownership. The first Collector run passed nine cases and
failed the new dataset case because its subprocess fixture omitted the field.
The fixture was corrected before rerunning the gate. A later focused build
caught a test fixture's overly broad event union; its return type now names the
tool event that it creates. The browser driver only reads hidden and checked
radio fields, so the new acceptance case fills visible fields explicitly, as
the existing cases do.

Final self-review found that HTML input patterns use Unicode `v` mode and need
an escaped literal hyphen. A rendered-pattern test failed, the pattern was
corrected, and all 206 focused tests passed. The runtime gates preceded only
this UI pattern correction. SQL and transport code did not change afterward.

The manager's browser review found that the new text field missed the shared
input style. The existing selector now includes text inputs. The repeated
review at 320, 390, and 1,200 pixels found a 52-pixel field with 17-pixel text,
working labels and keyboard controls, valid native pattern checks, and no
horizontal overflow. This small style change uses manual browser evidence.
A separate review strengthened the malformed-settings test to assert that its
seed row exists. Its focused rerun passed all 39 cases.

The manager selects the complete candidate's ordinary suite, build, type,
quality, and release checks. These local checks do not claim production rollout
or approval of the complete candidate.

## Review impact

This change adds an optional field to the public `AuditDestination`, public
settings projection, and Save input. Save can return the fixed invalid reason
`dataset`. These declaration changes require refreshed API snapshots and T2
review under the repository's fact-d rule. There is no new source component,
dependency edge, package, or System-to-Audit path in this implementation.

The manager owns the complete architecture comparison, notice changes,
deployment configuration, live Axiom verification, and review evidence.
