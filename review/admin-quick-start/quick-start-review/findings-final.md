# Admin Quick start impact and document findings

Worker review complete, 28 October 2026. This review covers the current working
tree against `feeaad4d5f04212f033366c232180be4bd40da4c`. The manager will pin the
final committed candidate and review the complete checks. These findings do not
supply final-candidate human approval or authorize merge.

No unresolved document or declared-impact finding remains in the inspected
scope. The source/test candidate and its metric evidence remain the manager's
responsibility.

## Impact declaration

`.pr-impact.json` records `contract`, `internalInterface`, and
`sensitiveBehavior` as true; every other classification flag is false.
`architecture.modelUpdated` is true for the registry prose change. All 20
listed evidence paths exist. The recommended tier is T2 Need architect for the
new browser route/creation destination and app-to-web configuration interface.
Independent authorized human approval must cover the completed current SHA.

The new guide uses the existing web owner, selected-session/current-access
checks, and organizations `authorizeSelection` read. App supplies trusted portal
and MCP configuration. No component, allowed component edge, public-surface
module, external integration, datastore, deployment relationship, or provider
operation was added. The final checker must confirm these mechanical facts.
No decision record is required solely because this is T2.

## Documents and canonical content

- The specification records the owner's 28 October implementation approval
  separately from review of the final candidate. The delivery boundary covers
  the protected page, full Markdown copy, Admin-first menu, and creation landing.
- Portal design, user guide, README, test inventory, and registry prose agree:
  Quick start comes before Connect for Admins. Later sign-ins, existing-access
  Continue, and normal workspace choices retain their existing destinations.
- The exact approved `guide.md`, legal documents, and existing Audit help were
  not edited. The manager reports that the Audit switch effects, recovery, and
  delivery notes are now visible beside the sequence, as the specification
  requires; the prior hidden Audit-details issue is resolved.
- A final manual execution of the current `quickStartContent` compared all
  approved substitutions with distinct portal/MCP hosts. Expected output is
  4024 bytes and actual output is 4018 bytes. All 23 paragraphs match in order
  after line-wrap normalization, and all six headings match exactly. The
  difference is formatting whitespace. No substantive copied-guide discrepancy
  remains.
- Local Markdown targets in the six changed prose documents, including the
  registry, all exist. `git diff --check` passed after the v2 artifact update.

## Architecture review artifacts

All 20 registry Mermaid blocks remain byte-for-byte identical to the trusted
base. Only the relevant registry prose changed. The supplementary L3 comparison
uses the hosted Node-server L2 container and the real app, web, organizations,
and workos source owners. Existing calls stay neutral; changed app/web meaning
has amber Changed labels. Four behavior notes preserve authority, trusted data,
method, failure, redirect, replay, and copy outcomes. L3 plus those notes is
sufficient; a separate L4 drawing would repeat them.

The manager rendered v1 with Mermaid 11.12.0 and existing Playwright at 800px.
Content and relationship treatment were approved. The boundary title wrapped
behind the app node. Draft v2 changes only that label to
`Thermus hosted Node server`; the notes keep the L2 scope explicit. The v1
source, notes, SVG, and PNG are retained. The manager will render v2, inspect
title clearance, verify the embedded Mermaid bytes, and sign off.

Files: `comparison-v2.mmd`, `comparison-notes-v2.md`, and the broader gate/view
assessment in `../quick-start-policy-review.md`. These ignored local artifacts
need accessible retained evidence links before use in the published PR.

## Edit freeze

A later review found a stale expectation in the existing hosted-live signup
scenario, `test/acceptance/auth/hosted-live/signup-server.ts`. The manager
reviewed a test-only fix: confirmed creation now waits for Quick start, checks
the trusted Acme Labs header and selected session organization, then follows the
actual Open Connect setup link before the retained native MCP flow. The test
inventory now describes that handoff and the existing first Admin role. The
scenario count is unchanged. This was a stale test expectation, not a production
bug or a production behavior change. No live-gate pass is claimed by this
documentation update. The test path was added to declared impact evidence;
the classification flags are unchanged.

This worker will make no further edits while the manager runs the candidate's
metric comparisons. No source or test code was changed by this worker. No
commit, push, publication, deployment, provider change, broad test suite,
container gate, metric process, or habit-hooks scan was performed by this worker.
