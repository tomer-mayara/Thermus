# Quick start “for AI agents”: independent review and selection

Base: `21458b0d18cc4f9efd3a59f6361a86f1acdc317c`.
Branch: `codex/quick-start-for-ai-agents`.
The final candidate SHA, execution results, checker, and complete-candidate
verification remain the manager's responsibility. No previous candidate pass
is reused as evidence for this candidate in this review.

## Source and document review

No confirmed defect was found in the inspected increment. The visible title is
exactly `Turn off direct internet access for AI agents`. The shared lead is
exactly the user-approved paragraph:

> Open each AI provider’s admin console, select your organization, and turn off direct internet access for its agents. Then connect Thermus for search and page retrieval. Keep Thermus and required agent services allowed. Thermus does not enforce these external network settings.

The canonical Markdown guide matches that paragraph after ordinary line-wrap
normalization. Its step heading uses the new shared title and retains the
existing `and connect Thermus` suffix. The unchanged page renderer consumes
that title/lead for the visible first step, and the unchanged Markdown
construction consumes the same values for copy. No second production copy
was introduced. The curly apostrophe in `provider’s` matches the approved text.

Provider links and their scope/fallback notes remain intact. The paragraph
still limits Thermus's role: required services remain allowed and external
network settings are not enforced by Thermus. HTTP routes, current-Admin checks,
organization selection/name, configured destinations, escaping, URL validation,
clipboard code, style/CSP bytes, and markup construction do not change. The
existing Connect navigation and copied guide link remain.

The exact superseded wording was not found elsewhere in source, tests, README,
or documents. The specification and user guide use broader purpose/scope
language, which remains accurate; no further inventory or document edit is
needed. No new tests, dependency, framework, metric exception, or mechanical
helper split is needed for this wording correction. The existing focused
rendering, canonical-copy, and narrow/wide browser checks should supply fresh
candidate evidence without introducing tests that only mirror constants.

## Architecture and tier

Expected **T0 Auto merge**, subject to the actual complete-candidate checker,
quality evidence, checks, and any holds. All classification flags are false;
`modelUpdated` is false. The fresh `.pr-impact.json` summary now names this
grammar/admin-console paragraph correction, with the existing scoped content,
page, focused-test, guide, and registry evidence.

The change is explanatory UI/Markdown copy within the web owner. It changes no
production callable contract, component responsibility, cross-owner interface,
provider integration, trust/admission guarantee, store, dependency, or deployment
relationship. `quick-start-content.ts` is not a listed public-surface module.
The existing file's MI exception is not automatically used: modified files use
`changedFileOutcome`, which does not look up a covering MI exception. The final
checker must still assess expiration, CRAP, report completeness, actual facts,
and every generated note instead of assuming eligibility.

The entire registry and all **20 Mermaid blocks** are byte-identical to the
base. Relevant hosted authentication/component, member-read/menu, ownership,
source-owner mapping, context/container, and deployment views remain accurate.
No registry edit, comparison drawing/render, ADR, or L4 detail is needed because
no callable contract or runtime relationship changes.

## Fresh candidate validation selection

The prior copy-only selection remains correct. A `src/interfaces/web/` change
selects the ordinary source checks, the self-hosted container gate, the hosted
offline build, and the final Linux AMD64 image gate:

```sh
npm test
npm run typecheck
npm run build:user-portal
npm run test:container
npm run build:hosted
npm run test:container:hosted
```

Do not add a separate `npm run check`; ordinary source validation already
covers its stages. The required `build:hosted` retains its nested checks. The
image proof must use Linux AMD64. Focused Quick start unit/acceptance and browser
observations should verify the exact new title/paragraph, canonical guide
parity, and longer-text reflow on this candidate. They do not replace the full
required selection or establish a whole-client coverage percentage.

**Hosted-live is N/A**: no source authentication/WorkOS behavior or live helper
changes. Whole Members browser, separate renderer/Brave, SQL, Collector, and
Render-interface gates are also N/A because their listed production behavior
and consuming test/support files do not change. The self-hosted container gate
is selected by the web source rule; this does not turn the task into a release
of the self-hosted evaluation image or add its separate release command set.

Run habit-hooks and the applicable base/head snapshots, process/review, and
CRAP assessment with compatible permitted coverage. Stamp and check the
complete committed declaration against this same base, record all retained
findings and allowed N/A reasons, and keep snoozes empty. Prior copy/remove-
button suite results are historical only; they are not fresh passes for this
source/declaration fingerprint. All final candidate results remain unclaimed
by this read-only source review.

## Authorized deployment follow-through

The user explicitly approved this copy fix and deployment. After merge, use the
existing Render Git service and verify its live deployment against the merged
SHA, then read back the visible title/paragraph and copied guide in the
authorized Admin context. This operational action changes no release
configuration, provider/legal setting, migration, service topology, or gateway
switch. It is not an image-runtime cutover or a self-hosted image release and
does not select hosted-live or unrelated gates. Merge alone does not prove a
successful deployment.

This reviewer read the current coding principles, gate/review policy, release
distinction, source/canonical diff, and relevant registry. The only tracked
write was the authorized `.pr-impact.json` summary update. No source, guide,
test, or other tracked file was edited by this reviewer. No test, build,
scanner, metrics process, PR, merge, deployment, publication, or additional
agent was started.
