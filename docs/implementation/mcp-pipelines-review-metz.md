# MCP pipeline review: Metz-inspired AI perspective

Date: 2026-10-18. Baseline: `27fa96c2bc47d890787a35be81ff6a2ebff42d61`.

This is an AI review that applies ideas from Sandi Metz. She did not take part
in this review and does not endorse it. This plan was written independently
after an initial design discussion, before reading the other reviewer's plan.

The scope is traffic through the Thermus MCP tool. The HTML-to-Markdown work
is incoming processing. Outgoing observation covers the supplied top-level URL.
It does not observe each redirect or renderer subrequest.

## Recommendation

Keep the incoming HTML processor as one outer decision. Keep its short array
runner for now. First clarify the two protocols, remove misleading contract
members, and state the completed processing result more clearly. These changes
have a smaller cost than replacing a working sequence with a new framework.

Consider fixed internal orchestration only when narrow leaf contracts can
remove real knowledge from the transformations. It is a conditional follow-up,
not a required part of this plan. Do not promote every transformation into an
outer allow/block decision to make the code look uniform.

Metz's [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)
warns that shared code can conceal different meanings behind conditions.
Here the two outer executors have different rules. Their similar syntax does
not establish one shared execution policy. DRY3 also gives no reason to merge
these two copies now.

## What the source establishes

The protected operation checks cancellation, permission, URL validity, and the
operation ID before work starts. It then observes the URL, fetches the page,
and processes its content. See [fetch-page.ts](../../src/page-fetch/fetch-page.ts#L23).
This is a clear division of responsibilities.

The [outer protocol](../../src/page-fetch/pipeline-step.ts#L4) returns allow or
block. The [inner protocol](../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts#L17)
returns an updated context. Inner transformations do not each make a release
decision. Giving both roles the name “step” hides this difference.

The array runner has a small job: create per-call state, run transformations in
order, and check cancellation between them. Production composition already
shows ads, sanitization, and conversion in that order in
[fetch-tool.ts](../../src/fetch-tool.ts#L22). Spelling these same calls out
elsewhere would not, by itself, simplify the system.

Source search found one production constructor call for this runner and no
separate CLI consumer. [package.json](../../package.json) declares a private
application and no package exports. This does not make internal test consumers
unimportant. Partial and repeated arrays are used deliberately. For example,
[redirect tests](../../test/unit/html-cleaner-pipeline/pipeline/redirect-metadata.test.ts#L17)
use conversion alone, while
[counter coverage](../../test/acceptance/pipeline-counters.test.ts#L11) repeats
sanitization and conversion. A replacement must preserve their tested behavior
or move those checks to the relevant public contracts.

## Strengths to preserve

The executors bind their record IDs to their trusted roles. They do not trust
the collaborator's supplied ID. The
[outgoing tests](../../test/unit/page-fetch/execute-outgoing-step.test.ts#L92)
make this rule explicit. This protects both record identity and code rules.

The outgoing executor refuses a changed URL and scan-specific block codes.
The incoming executor accepts typed withholding codes. Both validate result
shape, read decision values once, and replace raw errors with fixed errors.
See [outgoing validation](../../src/page-fetch/execute-outgoing-step.ts#L35)
and [incoming validation](../../src/page-fetch/execute-incoming-step.ts#L40).
These differences are meaningful policy, not incidental duplication.

Each entered outer step attempts one terminal record after its work settles.
There are at most two such attempts in an operation. An early guard failure
can produce none; fetch failure can leave only the outgoing record. A sink
failure cannot change the result or repeat work. See
[step-record.ts](../../src/page-fetch/step-record.ts#L20).
These are best-effort attempts, not proof of durable log delivery.

Typed scan withholding is independent of warning text. The
[removal session](../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-removal-session.ts#L37)
returns empty HTML and a typed code. The sanitizer carries that code, conversion
still runs, and [ProcessHtmlStep](../../src/html-cleaner-pipeline/process-html-step.ts#L15)
makes the incoming decision. The MCP adapter returns exact empty success for
withholding. Ordinary empty content also returns exact empty success.

Cancellation prevents later work and release after the current work settles.
It does not promise immediate interruption of synchronous parsing or scanning.
The [capacity owner](../../src/mcp/single-fetch-operation.ts#L3) keeps its slot
until settlement, including cleanup. A new pipeline protocol must not weaken
that rule by racing a running operation against cancellation.

## Actual costs and their limits

The [context](../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts#L4)
holds source URLs, changing HTML, optional Markdown and title, cumulative
counts, findings, warnings, and typed withholding. Each transformation can
replace all of them. This makes preservation of unrelated fields a convention.

The ad cleaner needs HTML and the final URL, but also carries report and output
fields. Its local result type even derives from the orchestration context:
[ad cleaner](../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts#L10).
The sanitizer adds findings and counts to prior reports. The converter merges
findings and warnings while carrying counters and withholding it does not use.
See [sanitizer](../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts#L39)
and [converter](../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts#L42).
This is demonstrated coupling. Inspection found no resulting MCP content defect.

The context's import of a scan code from the removal session is same-package
type coupling. It is not a runtime architecture violation. Moving that type
alone would not address ownership or sequencing.

The outer generic result type permits scan codes for outgoing work that its
executor must reject. Its required collaborator ID is unused by the executor.
These are separate contract problems: one concerns compiler precision, the
other concerns authority. Neither requires a generic registry or runner.

## Improvement slices, in order

### 1. Establish the behavior record

Run relevant existing focused tests before structural changes. Add passing
characterization coverage only where important existing behavior is missing.
Do not break a passing acceptance case to manufacture a red test for a refactor.

Cover exact URL spelling, final-URL rules and link resolution, report ordering
and deduplication, count meanings, empty output, typed withholding, malformed
results, cancellation, and sink failure. Keep runtime tests as runtime evidence;
test doubles cannot establish real renderer cleanup.

### 2. Clarify role and authority contracts

Rename the inner `Step` and `Ctx` to names such as `HtmlTransformation` and
`HtmlProcessingContext`. Keep names consistent across leaf interfaces and tests.
Do not add wrappers to preserve old internal names indefinitely.

Remove the supplied `id` from the outer collaborator execution contract. Keep
fixed IDs at the trusted record bindings. Update type checks and tests without
weakening the tests that show untrusted properties cannot choose record roles.

Review outgoing result typing separately. Prefer a small code parameter or
role-specific result alias only if it catches outgoing scan codes at compile
time without casts or a policy framework. Keep runtime validation for malformed
JavaScript values, wrong codes, inherited fields, and changing getters.

### 3. Keep completion ownership at the existing decision boundary

Partial arrays must still be allowed to return a context without Markdown.
Do not change the general runner's return type to claim that every array
produces a complete document. Conversion-only and ad-only callers remain valid.

ProcessHtmlStep owns completion validation. Its existing StepResult<string>
already expresses a strict outcome: allow with string Markdown, or block with
a typed code and no output. Keep this contract. Do not mandate a second HTML
completion union or mapping boundary. Clarify the ownership in affected names
and documentation during slice 2; this slice needs no independent code change.

Retain the diagnostic context for direct pipeline consumers. Preserve its title,
counts, findings, warnings, and metadata. Do not turn an optional field into a
required field through a cast. Keep malformed-result checks at the runtime
boundary even if TypeScript gives trusted callers a stronger result type.

Defer a different completed-result type until a concrete requirement adds an
invariant that StepResult does not express. A wrapper around optional Markdown,
an assertion, or a duplicate allow/block union does not justify a new contract.

### 4. Conditional: transfer preservation knowledge to one processor

Only start this slice when a concrete change shows that broad context contracts
increase cost, or when the team requires enforced ownership of source identity
and accumulated reports. Compare its full migration cost with keeping the loop.

Useful narrow inputs would be HTML plus final URL for ads and conversion, and
HTML for sanitization. Their results would contain changed content and their
own reports. One processor would retain both URLs and combine reports in the
current first-seen order. This would prevent a leaf from erasing prior findings
or changing requestedUrl by accident.

Fixed orchestration earns its cost only if it removes the universal context
protocol and related preservation knowledge in the same coherent change.
Do not keep a second permanent runner, adapter chain, generic report reducer,
or state framework. If these layers are necessary merely to recreate today's
three calls, retain the smaller design and stop.

Move partial-array tests to the relevant public leaf contracts without adding
unrelated stages to them. Preserve repeated-report invariants in focused tests.
Keep separate integration coverage for the complete processor and MCP outcome.

## Flattening choices and deferred changes

Full outer flattening would require typed inputs for different stages, trusted
record bindings, validation, and deliberate block semantics. It would also
change records if each transform became an independently recorded decision.
There is no current requirement that pays for these changes.

Retaining nested transformations is the recommended default. Conditional fixed
orchestration can simplify ownership inside the same incoming boundary. It need
not create more outer steps or records.

Stop conversion immediately after withholding only as a separate behavior
change. Today conversion sees empty HTML and can still fail or observe later
cancellation. Early stopping can alter that behavior and diagnostic fields.
Specify its required observable result with a failing BDD acceptance case,
then use TDD for the changed collaboration. Do not infer decisions from warnings.

Add stage-level records only for a stated operational need with a safe data
contract. Add stronger cancellation only with a measured latency requirement
and an interruptible implementation. Preserve cleanup and capacity proofs.

## Verification and evidence limits

This review used source and test inspection only. No new runtime verification
was executed. The historical [MCP-PIPE-04 record](mcp-pipe-04.md) is historical
evidence and does not prove a future candidate.

Implementation must follow [AGENTS.md](../../AGENTS.md), the
[test layout](../testing/test-code-layout.md), and the
[gate policy](test-gate-policy.md). Run every changed test locally. Classify
tests by real package collaboration, not speed or folder convenience.

Before Ready, run check, habit-hooks, applicable integration and acceptance
suites, renderer and container gates required by changed paths, and the complete
candidate ast-metrics review. Record actual counts and missing prerequisites.
Do not split functions only to improve scores. The owner reviews the PR; no
agent reviewer is required. This document approves no implementation or merge.
