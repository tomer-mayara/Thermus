# UI-02 — Member rows and quiet removal

Scope: [UI-02](../design/organization-admin-plan.md#ui-02--member-rows-and-quiet-removal)
of the Refined tabs plan. This work is stacked on
[UI-01, PR #263](https://github.com/tomer-mayara/Thermus/pull/263), at
`a017020ebe2448f5de6cc7d9cbb0700367fc80b1`.
Candidate: [PR #264](https://github.com/tomer-mayara/Thermus/pull/264).
UI-02 is implemented. This record claims no merge or deployment.
Current validation, review status, pins and results are in its maintained
[Validation](https://github.com/tomer-mayara/Thermus/pull/264#issuecomment-6427827431)
and [Quality review](https://github.com/tomer-mayara/Thermus/pull/264#issuecomment-6427827759)
comments.

## Behavior

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


## Implementation evidence

New HTTP and integration cases first failed for the missing active-row count,
labelled facts and trusted self-action name. Browser cases first failed for
missing labels and the red initial trigger. The page now uses native definition
lists inside existing member rows, with a counted `Members · N` heading. Role
labels and the separate product-access caption stay unchanged.

The native summary says Remove… or Leave… and has a specific accessible name.
The final confirmation uses the existing protected form. A duplicate email cannot
select You or Leave. Unsupported rows remain visible without a mutation control.

Independent review found cramped expanded confirmation text at 481px. A browser
case failed before the fix. Member facts now stack through 860px; regression
checks cover 481px, 600px and 860px. Desktop facts remain aligned. Existing Audit
layout, controls, optional script, Save/Test and help checks stay in the gate.

Focused validation passed 123 ordinary cases and 19 browser cases, plus the build,
typecheck and portal build. Fresh JavaScript-off journeys cover self and other
members, Cancel and one confirmation at 320px and 1280px. They verify no write on
Cancel, one POST on confirmation, retained account and other membership, and the
existing safe recovery page. The live removal test now expects Remove for another
member and Leave for the actor; this selects the staging gate. The removal DSL
and SQL/Collector test helpers do not change.

The final PR comments hold the complete ordinary, image, staging, metrics and
review results. This source increment remains inside Web. It adds no component,
import edge, public declaration, provider read or security rule. All 15 registry
views remain accurate. The existing private renderer contract is unchanged; a
new architecture drawing would not add useful detail.

Complete ordinary validation passed 5,131 tests and 49 portal tests. The staging
gate passed all 29 tests, including removal, retained access, token expiry and
session recovery. Its owned removal fixtures were cleaned up with no failures.
The changed live test ran before the source commit; all tested source, test and
build input hashes were then verified against that commit.

The first quality run could not measure the member-row callback with unit
coverage alone. The existing integration suite already exercises that renderer.
All 1,158 integration tests passed under coverage collection, and all changed
function goals then passed. This needed no source change or metric exception.
The earlier unit capture also passed 3,301 emitted and 29 portal unit tests.
The Quality review comment records the retained maintainability findings and
the scope of each coverage report.

## Density correction

The stack review found that the three short closed rows exceeded the 72px
desktop fixture bound. A new browser acceptance case first failed at 1280px
after the production fonts loaded: the rows measured 118.39px, 118.39px and
98.39px. The same case checks visible, unclipped Member, Role and Action facts,
closed disclosures, quiet triggers and 48px action targets.

Above 860px, each fact now places its label beside its value, and member rows
use 10px vertical padding. Semantic definition lists and aligned fact columns
remain. The rows now measure 70.25px, 70.25px and 60.25px. This is a fixture
bound, not a fixed row height. Long values, enlarged text and open confirmations
can increase row height. The stacked layout through 860px is unchanged.

The focused case passed after the CSS change. All 20 current Members browser
cases then passed, including long values, 200% text, 320px and 1280px layouts,
expanded confirmations at 481px, 600px, 860px and 861px, native Cancel and confirmation,
and shared Audit controls. The current portal and server builds passed before
these runs. Screenshots were checked for compact rows and expanded content.
No markup, protected form, route, identity rule, product count or help changed.
These focused results do not replace the manager's complete-candidate gates.
