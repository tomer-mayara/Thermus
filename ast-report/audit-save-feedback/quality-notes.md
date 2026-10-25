# Quality review: Audit Save, Test, and feedback

Candidate `e9e2185663f62690809640c5434ad24582843835` against merge base
`74f756562231fb6aafd6a87f4bbd0f02bc0a208e`.

## Review tier and promises

The checker selects **T2 Need architect**. Its generated reason is
**T2: declarations changed in 1 public module**. The only mechanical architecture
fact is `architecture.declarations_changed`: the saved-settings service's public
projection adds optional `tokenPreview` (+1, -0 declaration lines). The declared
`internalInterface` flag also requires T2 for changed web-to-audit collaboration.
The `sensitiveBehavior` flag retains T1 concerns about Save integrity, recovery,
and limited credential display. All other impact flags are false. No exception,
de-escalation, policy waiver, or human approval is claimed.

The checker reports local eligibility with zero technical blockers. This is a
preliminary result. Overall merge is blocked until the complete required checks
and an independent authorized architect's approval cover this exact candidate.
Agent reviews do not meet the human approval requirement.

The selected policy question is `protected_paths.contracts`: does a client,
user, or operator see a different input, output, error, or default? Yes:

- The browser's Test action now saves the displayed settings before testing the
  confirmed returned revision. Its label is Test. A failed or uncertain Save
  starts no Test. Test failure does not undo a confirmed Save.
- Save and Test return the normal Audit layout directly. Confirmed saved text is
  beside the actions, clears after 30 seconds or an edit, and refers only to the
  saved revision shown. Uncertain writes retain GET-only recovery; they can still
  commit later. No automatic retry is added.
- The Admin sees a saved token's first four characters plus masking; tokens of
  four or fewer characters are fully masked. The password input value stays
  empty. Blank input retains the saved token only under the existing endpoint
  rules. The hint is not a new credential or a Test input.
- A hash-pinned script restores scroll from one expiring position/time record.
  It stores no form data. Storage failure cannot stop native submission. Timed
  clearing and restoration need scripts; native actions retain honest results
  without them. Deliberate POST resubmission may repeat an unchanged Test.

Current Admin, exact Origin/CSRF/form checks, trusted tenant/actor, revision
checks, encrypted storage, public-address/TLS policy, and sender bounds remain
at their existing owners. Neither a synthetic Test nor this local validation
proves continuing delivery or downstream retention.

## Architecture and review evidence

The checker informational note is **48 public modules, 1 snapshot changed**.
The addition is reviewed as an observable display contract, not a sender or
storage contract. The other 47 snapshots are unchanged. All 13 Mermaid blocks
in the component registry are byte-identical; registry prose and the active
plan, implementation records, and test inventory now describe the new flow.
There is no new component, dependency, public module, container, deployment,
decision record, datastore, or framework. No undeclared import, forbidden edge,
new cycle, or grown known cycle is reported.

The main comparison uses the manager-approved v5 L3 drawing. It marks the web
owner and audit public projection as changed; retained runtime relationships
and supporting L2 PostgreSQL/destination peers stay neutral. See
[v5 review notes](../audit-save-and-test/architecture/v5/review-notes.md) and
[final pinned provenance](../audit-save-and-test/architecture/v5/provenance-e9e2185663f62690809640c5434ad24582843835.json).
These retain before/after source, all registry view hashes, diagram source,
renders, earlier drafts, and manager feedback. The strongest shared contract
is PublicDestinationSettings read/Save output. L3, the folded declaration diff,
and phase/recovery notes answer visibility and commit/send ordering; L4 adds no
needed explanation and is omitted.

The independent reviewer found one readability defect: the default token-hint
contrast was 3.85:1. The final Audit-only placeholder rule raises it to 9.05:1.
The manager inspected the desktop/mobile behavior images and the corrected
hint image. The implementation worker, independent reviewer, and manager
found no remaining production defect. The earlier browser proof is bridged to
this head by an exact test type annotation and CSS-only diff.

The selected tests replace five old test declarations and add nineteen. Four
replacements update saved-only Test and action metadata expectations; the fifth
updates presence-only projection to the requested masked prefix. Current tests
retain security refusals and require Save-before-Test. No new skip or todo
exists. Production/total changed lines are 228/967, below size-note thresholds.
The checker's only other note says local eligibility cannot replace current
checks and human approval; the merge hold above applies.

## Metrics and retained reasons

The final process completes all four stages. Raw exit 1 reflects Delta and
Review goal misses. CRAP and Architecture pass, and standalone CRAP exits 0.
No required section failed or lacks evidence. The fresh complete unit capture
passes 3,088 backend and 29 portal tests. Full fingerprints, capture identity,
counts, and final head/base bindings are in [gate validation](gate-validation.json).

| Existing production file | Base MI | Head MI | Reason to retain |
| --- | ---: | ---: | --- |
| destination-settings-service.ts | 39.7 | 39.0 | This owner validates input, enforces revision and credential retention, and projects confirmed results. The change reuses the already validated decrypted credential for a small display projection. Separate preview storage or a new service would add state and split the credential boundary. Read, Save, and projection have measured coverage of 100%. |
| logging-routes.ts | 47.8 | 47.9 | Ordered method, Origin, exact-form, tenant, capability, and revision guards stay together. Named Save, Test, recovery, and rendering helpers make partial success explicit. A Test whitelist prevents new public display fields from entering the send path. |
| logging-page.ts | 69.0 | 65.0 | One form owns native validation, destination choices, empty token input, fixed result, and feedback placement. A small existing hash-pinned script owns progressive display and scroll behavior. Further splitting would scatter the form's conditions without a new role. |
| logging-test-page.ts | 71.8 | 70.4 | Typed fixed notice tables keep every result covered and prevent remote responses or exception causes from reaching the page. The result functions have CRAP 2 and 1. |
| members-style.ts | N/A | N/A | A constant CSS template has no measured function or MI. Audit-scoped result/status/placeholder styles are checked with browser images and contrast measurement. |

There is no new production file or production MI drop of five or more. No
metric exception is used. The high review finding is test-only MI 36.1 to 28.4
in logging-test-routes.test.ts. Its single route contract keeps typed outcomes,
ordered side effects, refusals, and recovery visible together. Production MI
goals do not apply to tests. The medium finding is new LoggingRoutes.change
complexity 12: explicit early returns preserve required boundary and phase order;
coverage is 100% and CRAP is 12. Extraction solely to lower the counter would
hide that order.

All required added/changed TypeScript functions meet CRAP limits. There are 31
reported rows, no limit violation, and no required unknown/unmeasured function.
The maximum changed-function score is 14; the maximum new-function score is
12.1. The one reported measured target miss is the unchanged service testSaved
function: CRAP 15.002737575 at 97.7% unit coverage. It is below 30 and unchanged
by this PR; the new-function limit does not apply. Other unchanged functions
retain that same classification. Base CRAP estimated with head coverage is not
measured base coverage. The embedded JavaScript string is checked by VM and real
browser tests; the TypeScript AST score is not a separate score for that script.

Full function rows and architecture context remain in the root process, CRAP,
review, and snapshot reports. The global architecture report retains its known
unresolved CSS import and incomplete untouched-function assessment. Those limits
are not new dependencies or proof of unseen edges. The review-tier checker also
checks the declared component graph and current required-function assessments.

## Habit-hooks disposition

Final serial checking covers all 20 existing supported changed source/test files
with the same repository sensors and config. Every invocation completes. The
aggregate is 42 findings; snooze remains `[]`. The initial branch-mode tool
failure and concurrent run remain historical. Exact final scope, commands,
locations, return codes, and findings are in habit-scope-final.json,
habit-execution-final.json, and habit-summary-final.json. No tool failure is
accepted as a finding disposition.

- Eight complexity findings: destinationForm keeps its related native field
  conditions together; the route handler preserves current Admin access and
  safe failures; change keeps the ordered Save/Test guards. In the service,
  authorizeExport and testSaved preserve current-version and cancellation
  checks, save keeps validation/credential/atomic-write order, and invalidInput
  owns one bounded input contract. The acceptance failure table distinguishes
  saved, unsaved, uncertain, and unavailable results. Each remains linear or
  explicitly table-driven, with focused behavioral coverage.
- Five parameter findings: route change, readPage, and page take values with
  distinct authority and lifetime (request, CSRF, trusted context, notice,
  confirmed revision/feedback). Service test/testSaved distinguish tenant,
  desired input, trusted actor, and cancellation. A generic bag would hide these
  distinctions; no separate domain object is needed for these private render
  steps or existing Test boundaries.
- Seven comments: three route comments state trusted access, secret-bearing
  collaborator errors, and capture-failure isolation. Two service comments state
  fresh-version export authority and trusted actor provenance. Two support-file
  comments identify shared cross-channel capture and deliberate store/access
  doubles around real route/service/codec/sender collaboration. These state
  constraints or test boundaries that names alone do not prove.
- Three oversized test files: hosted-destination-settings, logging-test-routes,
  and destination-settings-service keep one cohesive contract each. Cases share
  focused setup and preserve distinct refusal and failure outcomes; line-count
  splitting would scatter them.
- Nineteen test-only non-null assertions: three account-route accesses, thirteen
  logging-route fixture accesses, and three service fixture/ciphertext accesses.
  They fail loudly when controlled fixture invariants break. Production code
  has explicit guards; this change keeps the existing fixture assertions and
  adds no unchecked credential or authority path.

## Validation limits and history

The narrow API emitter reports 33 ignored diagnostics in two files outside the
public surface; all 48 snapshots are current and the full typecheck passes.
Failure/retry history, BDD/TDD red/green runs, gate selection, and current complete
test results belong in Validation and [the evidence index](review-index.md).
Earlier full-suite and metric reports remain historical. No production change,
live customer receipt, or current-candidate human approval is claimed.
