# Quick start AI Agents copy: independent review and selection

Candidate: `0445dfa6e566bf99155a6bf8f4e65c7619b3c322`.
Base: `cc2ed669d6821525e23c6ff3d6ddcdc6339862bd` (`origin/main`).
Branch: `codex/quick-start-ai-agents-copy`.

This restores the independently reviewed assessment under a distinct ignored
filename. The generated metrics `review.md` remains untouched. This reviewer
made no tracked edit and ran no tests, builds, metrics, scanner, deployment, or
publication. The manager reports all selected gates pass; the final checker is
underway. Final complete-candidate classification remains the manager's work.

## Findings and scope

No confirmed code or document defect found in the reviewed increment. The
shared content changes only `internet.title` and the specified sentence inside
`internet.lead`. The visible title is exactly
`Turn off direct internet access to AI Agents`, and the sentence is exactly
`Turn off direct web access to AI Agents, then connect Thermus for search and page retrieval.`
The surrounding provider-selection, required-service, and external-enforcement
limitations remain. No links, provider URLs, escaping, URL validation, script,
style, markup construction, or callable signature changes.

The canonical guide contains the same two wording changes. Its generated step
heading retains the existing `and connect Thermus` suffix, as the manager
confirmed; the visible UI heading uses the exact requested title. The guide
therefore agrees with the unchanged Markdown construction. No other complete
old title or direct-web-access sentence was found in source, tests, README, or
documents. The specification and user guide use broader purpose descriptions,
not these exact display strings; no further document or test-inventory edit is
needed for this scope. Illustrative mockup images are not current product copy.

The source worker reported focused tests 14/14 and the existing Quick start
browser cases 2/2 passing. See `focused.log`, `browser.log`, and
`validation-notes.md` in this folder. The external HTML artifact's manual checks
are separately retained under `artifact/`; they do not select a new production
gate. The manager subsequently reports that the complete selected gates pass.
Use the final Validation evidence for exact commands, candidate identities,
counts, and accepted provenance rather than infer them from this review.

## Classification and architecture

Expected **T0 Auto merge**, pending the final checker and complete-candidate
review. The reviewed `.pr-impact.json` describes this copy increment rather
than the earlier button removal. All classification flags are false and
`modelUpdated` is false. The summary and scoped evidence agree with the code.

This is internal UI/prose wording. HTTP methods/routes, current Admin authority,
selected-organization context, configured payloads, provider operations,
cross-owner interfaces, dependencies, composition, data, and deployment retain
their existing rules. `quick-start-content.ts` is not a listed public-surface
module; changing its internal string values adds no declaration-snapshot fact.
No protected policy/security/deploy/contract document or exception file changes.

The existing content-file MI exception does not itself cause T1. This file is
modified, not added; `changedFileOutcome` does not look up a covering MI
exception. An expired entry, CRAP miss, new scope, or missing evidence can still
affect eligibility, so retain the final checker result rather than assume it.
No new metric exception or test case is required by this copy correction.

The complete registry and all **20 Mermaid blocks** were byte-identical to the
base at review. Checked hosted authentication/component, member-read/menu,
ownership, source-owner mapping, context/container, and deployment views remain
accurate. No registry edit, comparison drawing, render, ADR, or L4 detail is
needed: there is no changed production callable contract or runtime
relationship.

## Complete-candidate gate selection

The changed `src/interfaces/web/` content selects:

```sh
npm test
npm run typecheck
npm run build:user-portal
npm run test:container
npm run build:hosted
npm run test:container:hosted
```

The last image gate must use Linux AMD64. The ordinary source validation covers
the stages of `npm run check`; do not add another separate `check` run.
`build:hosted` keeps its required nested checks. Preserve focused rendering and
copy-parity evidence plus the narrow/wide browser observation for the longer
heading. The focused runs do not replace the ordinary/source gates.

**Hosted-live is N/A**: no authentication or WorkOS organization behavior,
signup helper, or other dedicated live test changes. The previous button-removal
candidate selected it because its live helper changed; that reason does not
carry into this new increment. Whole Members browser, renderer/Brave, SQL,
Collector, and Render-interface gates are also N/A because their listed
production behavior and consuming test/support files do not change. The code
increment adds no release configuration, provider setting, legal acceptance,
or migration change. The conversation's authorized operational follow-through
still includes deployment after merge through the existing Render Git service;
that does not add an unrelated test gate to this copy-only increment.

Habit-hooks and the applicable production snapshot/process/review/CRAP
assessment require compatible permitted coverage, followed by the complete
committed impact declaration stamped and checked against this same base.
Record actual results, retained findings, and allowed N/A reasons in the
maintained PR comments. Do not change test selection through coverage collection
or treat unchanged architecture as permission to skip source checks. Final
eligible T0 needs no independent human approval, but still requires the
manager's complete-candidate verification and the user's requested stopping
point.

## Final scope reconciliation

The committed candidate contains the reviewed shared title/lead, matching
canonical guide, and copy-specific impact declaration, plus the generated
immutable base metric record. That record preserves metric history; it adds no
production behavior, test group, configuration, or release step. The manager
reports all selected gates pass and is completing the final checker. This note
does not claim a final checker result, merge, or deployment before those actions
are recorded.
