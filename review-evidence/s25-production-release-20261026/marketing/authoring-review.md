# Slice 2.5 policy candidate review

Prepared 26 October 2026 in this isolated clone. No push, PR, or deployment was
made. The primary and other managed Marketing checkouts were not changed.

Base and last remote read: `654eebabb6465967edf8d4b0388708e6421f0691`.
Branch: `codex/s2-5-removal-notices`. The six-file candidate is committed locally as `b07ea8836e3a8df1a8766af81846b25251915549`.
Complete diff: `candidate.patch`, SHA-256
`3bfeb184be02acd59051eaff63e7ba465202741157f092bb461728a2a2e230e2`.
`candidate-review.json` pins every changed file hash. Recheck the fingerprint if
any file changes before publication.

## Result

- Exact approved Terms and Privacy copies replace the currently published Audit
  v3 copies in `src/content/legal/`.
- The two existing Astro wrappers use the approved version and source hash.
- The existing complete-policy rendering test uses the new identifiers and
  26 October date. Its text/link/table/anchor/route checks are unchanged.
- `docs/legal-content.md` records approval, current source and retained history,
  existing-organization limits, verification, and pending publication.
- No dependency, route, renderer, layout, callable contract, or runtime service
  changes. No new test or skip/todo marker. The five-document source and its
  manifest remain exact. No Thermus root source or document was edited here.

The direct owner response was “Approve this package and continue the release”.
The separate Thermus record is
`docs/legal/organization-removal-2026-10-26-proposal-v1/owner-approval.json`.
The Marketing document now links to that exact file at immutable Thermus commit
`7f2e22ff706c3c81da07ee70ec16bb7d6cf4a0ba`; the GitHub connector read it successfully. Its recording time is not a claimed reply time.

Approved bundle: `s2502-organization-removal-proposal-2026-10-26-v1`.
Approved manifest SHA-256:
`7528832b4e2baf055d4be35ec2d12fe3d00a9681d0a7684dc5f246e830c4071e`.
Terms: 20,941 bytes, SHA-256
`164e013e2cbf0889ad5aaaef14aac745acaed01023bc914c7adae1a4bf4ce048`.
Privacy: 38,594 bytes, SHA-256
`df330cf3d905f4bd6f64d3a9dfd8dded5be476c39e40e05b87596e6678429b1c`.

## Validation

Final checks used explicit Node `24.20.0` and npm `11.19.0` PATH. Locked `npm ci`
and `npm run check` passed. All 62 tests passed, with zero failures, skips, or
todos. The existing policy case verifies both production and deploy-preview
local builds. Typecheck and final build passed. `git diff --check` passed.
Homepage budget: 113.2 KB gzip / 200 KB; executable JavaScript: 3.51 KB / 10 KB.

The existing acceptance oracle was changed first. Its focused RED run failed
on the old Terms hash versus the approved successor hash. After exact source
copy and metadata changes, the final full suite passed. No new prose test was
added. Logs: `acceptance-red.log`, `npm-ci.log`, and `npm-check.log`.

Manual local Chromium review at 375 and 1,280 pixels, JavaScript disabled,
checked both complete policies. All four observations passed complete visible
text equality, approved source hash, one H1, all anchors, direct email, unchanged
footer links, no horizontal overflow, and no page errors. The existing complete
policy test also preserves every source link and all table cells (13 Privacy
rows). Full-page and focused screenshots are in this directory. Reviewed focused
screenshots show readable removal text, Audit text, and mobile/desktop retention
tables. `browser-facts.json` records the complete observed facts. This is local
static-build proof, not a deployed preview, physical-device, or full accessibility
audit. The temporary HTTP server and browser were closed after review.

Retry history: the first locked install and full check used Homebrew npm's
Node 22.14.0 despite the shell `node` resolving 24.20.0. That suite passed, but
its engine warnings made it unsuitable as final environment proof. Both commands
were rerun successfully with the explicit Node 24 PATH. Initial logs are retained
with `initial-node22` names. The first manual review used a wrong audit-heading
selector; it timed out after the complete mobile text checks. The selector in
the ignored review script was corrected and all four observations rerun.
The final install warns only about the optional fsevents install script needing
npm allowScripts approval; no approval or dependency change was made, and the
build and browser checks pass without it.

## Quality review

No Marketing AGENTS.md or CLAUDE.md was found in the fresh clone. The applicable
Thermus ancestor instructions and coding principles were read. The six-file
candidate follows the manager's narrow publication scope. No new executable
behavior needs unit tests; the existing acceptance rendering case covers the
published source selection. Production architecture and public callable
contracts are unchanged. No new C4 comparison or L4 view is needed.
Marketing contains no Thermus ast-metrics or PR checker setup; no empty metric
reports or unrelated tooling were added. The manager owns final classification
and complete release eligibility.

Default habit-hooks reported no configured files and scanned nothing. That
result is not treated as a scan. A second scan used ignored `habit-config.toml`
to select all six changed files with the installed TypeScript and generic
plugins, the Thermus ESLint rules, no snooze transformer, and `--no-snooze`.
Knip was not used because it checks the full package and no import/export or
executable logic changed. jscpd follows the repository's disabled setting.
`habit-hooks-configured.log` retains these findings and reasons:

- Existing complete-policy test callback complexity at line 145 is retained.
  Only its name and four source identifiers/date change. Its existing decisions
  verify the complete document contract; no new decisions are added.
- Existing comment at test line 13 explains why builds exercise the finalizer.
  Existing wrapper comments at line 8 explain why imported H1 is removed.
  All three comments are unchanged and explain renderer constraints.
- The approved complete Privacy Markdown exceeds 200 lines. It is one complete
  frozen legal document, copied exactly. Splitting it would change the approved
  bytes and public document structure.

No snooze file was created or populated. The manager signed off the complete source scope, metadata, test diff, and
review report. The final change is only the requested immutable approval link. This subagent does not claim independent human approval
of a later code head or final release eligibility.

## Publication controls

The manager will review and perform publication. Keep preparation local until
that review. If a later branch push or draft PR must not deploy yet, use
`[skip netlify]` in both commit and PR title and verify no deploy starts. Remove
skip directives from the explicit approved merge title/body when publication is
intended. Do not change Netlify settings or non-production SSO access controls.

Marketing `main` automatically builds `npm run check` and publishes `dist/`.
After merge, verify ready production deploy ID and exact merge SHA, actual time,
both slash and direct routes/redirects, complete text, every source link and
table cell, source metadata/date, direct email/footer links, Cloudflare response,
and responsive layout. The URLs render HTML; compare approved Markdown source
bytes separately from rendered HTML content. Do not claim HTML bytes equal the
Markdown hash. A later effective date needs a complete successor approval.

Thermus runtime/help integration, old acceptance preservation, production
capacity/storage, and scoped deployed Slice 2.5 proof remain separate gates.

Final local commit: `b07ea8836e3a8df1a8766af81846b25251915549`, title `[skip netlify] Publish approved membership removal Terms and Privacy`. The final approval-link read passed. No broad check was repeated for that document-link-only change. Source, wrapper, and test hashes remain identical to the reviewed candidate. Working tree is clean; ignored evidence remains local.
