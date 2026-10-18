# MCP pipelines: Martin-inspired AI review and improvement plan

This is an independent AI review informed by Robert C. Martin's design
principles. Robert C. Martin did not participate in or endorse this review.
The review date is 2026-10-18. The source baseline is
`27fa96c2bc47d890787a35be81ff6a2ebff42d61`.

The recommendation is to retain one incoming HTML-processing boundary and
start with small contract and naming changes. Do not make replacement of the
inner array runner a required step. Its cost must be compared with the cost
of new mappings, narrower records, and changed test compositions.

## Scope and method

The scope is traffic through Thermus MCP. The outgoing role observes the
top-level requested URL. It does not observe every redirect or subrequest.
HTML cleaning and Markdown conversion belong to the incoming path.

I inspected source and meaningful tests. I did not run tests, gates, metrics,
or runtime experiments. The historical results in `mcp-pipe-04.md` are useful
context, but they are not fresh proof for this review or a future candidate.

The design reference is Martin's [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).
Its useful rule here is that application policy owns the contracts it needs,
and external details adapt to those contracts. It does not prescribe a fixed
number of layers. Simple data can cross a boundary without a class wrapper.

## What the implementation does well

`src/page-fetch/fetch-page.ts:22` puts access, URL validation, outgoing work,
fetching, and incoming work in one protected operation. MCP result formatting
stays in `src/mcp/get-url-as-markdown.ts:7`. The operation does not depend on
the MCP SDK, Defuddle, or the concrete Lightpanda implementation.

`src/fetch-tool.ts:21` is a clear composition root. It selects ads, sanitizer,
conversion, renderer, and logging. `ProcessHtmlStep` adapts the cleaner to the
application-owned decision contract. This boundary has a useful purpose.

The two executors validate results at runtime. Outgoing success must preserve
the exact input URL (`execute-outgoing-step.ts:35`). Incoming success requires
a string; recognized scan withholding carries no released payload
(`execute-incoming-step.ts:40`). Static types do not replace these checks.

Record identity comes from the trusted executor binding, not a collaborator's
`id` (`execute-outgoing-step.ts:31`; `execute-incoming-step.ts:36`). Tests use
throwing ID getters to prove that supplied identity has no authority.

Each entered outer step makes one best-effort terminal record attempt. There
are up to two such attempts per operation. Guards, fetch failures, or early
cancellation can leave fewer. A record sink failure cannot repeat work or
change its result (`src/page-fetch/step-record.ts:20`).

The fixed step record excludes source HTML, Markdown, warnings, URLs, and raw
errors. MCP completion records have a separate purpose and contain identity,
the URL origin/path, and the supplied reason (`tool-completion-record.ts:7`).
Do not describe all logging as payload-free or change its schema incidentally.

Cancellation prevents later stages and release after the signal is observed.
It waits for pending work to settle. The hosted single slot remains occupied
until the operation settles (`single-fetch-operation.ts:3`). These rules avoid
releasing capacity while owned cleanup is still active.

## Costs and design limits

The inner `invoke(Ctx)` protocol transforms data. The outer `execute` protocol
decides whether output may leave its role. They have different responsibilities.
Uniform syntax would not make them one concept. Today only the sanitizer
produces typed scan withholding. Ads and conversion can fail by throwing.

`Ctx` combines fetched metadata, transformed HTML, optional Markdown/title,
counters, findings, warnings, and optional withholding
(`html-to-markdown-pipeline.ts:4`). Each leaf carries fields that it does not
use. The ad result even derives its shape from `Ctx`. This is real source
coupling, but its practical change cost has not been measured.

The withholding type comes from the removal-session file. This is a same-package
type dependency, not runtime infrastructure leakage. Move ownership only when
a clearer shared contract needs it; do not add a new package for this alias.

The runner is small and production composition already shows the order
ads → sanitizer → converter. Replacing its loop with three calls alone gives
little benefit. It also changes useful internal callers: tests compose ads
alone, conversion alone, sanitizer plus conversion, and repeated transformations.

Examples include `test/interface/website-fetcher-redirects.test.ts:23`,
`test/acceptance/hosted-ad-policy.test.ts:10`, and
`test/acceptance/pipeline-counters.test.ts:11`. The last case checks stable
counts and reporting through repeated sanitizer/converter passes. Preserve
that behavior even if its test later uses a different public interface.

Source search found one production runner constructor, in `fetch-tool.ts`,
and no separate CLI constructor. `package.json` is private and declares no
library exports or entry point. This does not prove that no external caller
imports a source file by path.

The outer `id` field is required but deliberately ignored. The broad block-code
union also permits scan codes in the outgoing static contract, although its
runtime validator rejects them. These are separate contract issues.

## Flattening alternatives

**Retain the runner and tighten its names and contracts.** This has the smallest
change cost. Keep transformations inside the incoming adapter. Give completed
processing a useful result contract without claiming partial arrays always
produce Markdown. This is the default recommendation.

**Use a fixed HTML processor with narrower leaf contracts.** This can be useful
if mandatory stage order/completeness becomes an invariant, or if the processor
can remove meaningful leaf knowledge of aggregation. For example, ads need
HTML/final URL; sanitization needs HTML; conversion needs HTML/final URL.
The processor could own source identity and stable report accumulation.
This option is conditional, not a prerequisite for improving the current code.

**Promote each transformation into an outer decision step.** Do not do this
now. It adds decisions and potentially records with no current caller need.
Keeping only the present two records would still need an aggregate boundary.
Future stage-level release policy or an explicit diagnostic requirement could
justify reconsideration. Adding a fourth transformation alone does not.

## Prioritized implementation slices

### 1. Preserve the observable contract

Before structural work, establish passing characterization coverage through
the relevant public interfaces. Reuse existing coverage where it proves the
requirement; add only material gaps. Do not create an artificial red test for
unchanged behavior.

Keep exact and empty Markdown, typed scan withholding, fixed safe failures,
guard precedence, early input limits, and final-URL link/rule behavior.
Keep original requested-URL spelling and source input immutability.
Keep counters, title, first-seen category order, and warning deduplication for
direct processor callers. No decision may depend on parsing warning text.

Keep converter continuation after scan withholding. The removal session emits
empty HTML plus a code (`hidden-html-removal-session.ts:37`). The converter
handles blank HTML (`clean-html-to-markdown-defuddle.ts:10`). Only afterwards
does `ProcessHtmlStep` map withholding to a block (`process-html-step.ts:15`).
Changing this sequence can change failure, cancellation, and diagnostic results.

Use the existing executor, processor, pipeline-cancellation, redirect, real MCP
pipeline, and single-slot tests as the starting evidence set. Tests with real
collaboration across logical packages are integration tests under AGENTS.md.
Keep their support code within the documented test dependency rules.

### 2. Make outer contracts state their real authority

Remove the supplied `id` requirement from the executable role contract and its
implementations. Keep record IDs in trusted executor bindings. Adapt tests to
continue proving that collaborator data cannot select the record identity.
Do not replace the property with a registry or an ID validation framework.

Consider direction-correct static result types in a separate small change:
outgoing accepts only `blocked`; incoming also accepts the two scan codes.
Use simple aliases or a bounded code parameter only if that makes signatures
clearer. Preserve the closed runtime validators and malformed-result tests.
Do not combine the two executors into a generic direction-flag implementation.
Their different failure and output rules remain easy to see today.

### 3. Clarify partial transformations and completed processing

Rename the inner `Step` role to describe a transformation if that reduces
confusion. A name change must not silently narrow supported array composition.
Retain the small loop and its cancellation checks initially.

Distinguish an intermediate transformation context from the result needed by
the incoming adapter. Partial arrays can legitimately lack Markdown. Do not
make `process()` promise required Markdown while it still accepts such arrays.
Use a completed-result contract at the full-processing boundary, with released
Markdown or typed withholding, only where an actual producer can honor it.

Keep diagnostic fields available to direct consumers. Use the existing
`ProcessHtmlStep` validation boundary where possible; do not add a second
wrapper that merely copies its checks. Its `StepResult<string>` already is a
strict completed decision owned by `page-fetch`; a second completion union is
not required. If a useful completed producer cannot
be introduced without duplicate wrappers or mappings, retain the current
runtime-validated partial result and document the distinction instead.

### 4. Reassess fixed orchestration only after the smaller work

Proceed only with a concrete benefit: enforced required order/completeness,
or a leaf change that becomes cheaper because aggregation has one owner.
Narrow inputs and changed-content/report outputs in the same coherent slice.
Avoid branded states, generic reducers, and a metadata framework.

Migrate partial tests to the relevant public stage interface where suitable.
Retain full-chain integration coverage and the repeated-report invariants.
Remove the old runner if replacement succeeds; do not maintain two permanent
orchestration systems. Stop if new wrappers and mapping code make the sequence
harder to follow or merely relocate existing spreads. Keeping the loop is an
acceptable completed outcome of this plan.

## Deferred behavior and extension triggers

Early stopping on withholding is a separate behavior proposal. Write a failing
BDD acceptance specification for it first, then focused TDD checks. State the
expected failure, cancellation, and diagnostic semantics before implementation.

Stronger cancellation latency needs a measured requirement and workload.
Passing a signal into synchronous scans cannot make the event loop interrupt
them. Any later execution change must prove cleanup and continued slot ownership
as well as responsiveness. Do not release capacity on signal receipt alone.

Keep fetch-port relocation deferred. `website-fetcher.ts` currently serves as a
public contract, although renderer reporting uses its exported error classes.
A second adapter with different failure policy may make application-owned
failure contracts useful. Directory placement alone does not justify duplication.

## Verification and completion

For implementation, run each changed test locally before commit. Run
`npm run check`, `habit-hooks`, and all applicable suites on the complete
candidate under `test-gate-policy.md`. Cleaner/composition changes require the
renderer gate; MCP changes require integration and acceptance runs and their
applicable container/hosted checks. A unit pass does not replace those gates.

Follow the repository ast-metrics delta/review process after documents are
updated and before Ready. Correct findings or record justified exceptions;
do not add layers solely to improve a score. Keep the snooze file empty.

The future implementation is complete when selected slices preserve the stated
contracts, changed tests and applicable gates pass, and the owner can review
one clear resulting design. This document records inspection and a plan only.
