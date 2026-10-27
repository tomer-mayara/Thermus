# habit-hooks review

Candidate 3380afe663c6a2ef02a0adda525faccd6f5b726f against UI-03
12d1a3c5b7cab197fa828ef89b7f650f918a7ea2. The hook exits 1 for retained findings;
it is not reported as a clean pass. The snooze file remains `[]`. No suppression,
performance exception or metric exception is added. The manager and independent
reviewer checked the new findings at the final candidate.

## Non-null assertions — seven retained

These are test observations, not production guards. None can turn a missing
value into a pass. They do not represent shared mutable ownership or a circular
construction dependency. This is retention under AGENTS.md's correct-or-explain
rule, not a claim of a performance exception.

- Page integration line 25: the required member-lists element is dereferenced
  immediately for its children. If absent, the test fails before any order claim.
- Page integration line 39: a fixed two-entry fixture and the preceding row-count
  equality constrain the index. A missing entry fails on its immediate access.
- Pending browser lines 17, 48, 56: Playwright evaluates attached live-page nodes.
  Their owning window is required for computed styles; a missing window throws
  at getComputedStyle. No optional success fallback exists.
- Pending browser line 50: the button locator is a descendant of the pending
  details. Its closest details is guaranteed by that locator; absence still
  fails at the DOM computed-style call.
- Pending browser line 59: a missing heading fails in getComputedStyle. The
  measured heading must then be exactly 64px after the explicit text resize.

Explicit guards could improve diagnostics, but they add no missing behavioral
check here. The independent assessment records the same invariants and no
false-pass path.

## Comments — 31 retained

- hosted-workos-administration.test.ts:9–12: states real composition, fake-role
  assumptions and the separate live proof requirement. Line 17 links the external
  ID fixture to the operator runbook. Lines 35–36 explain product seats for the
  mixed/default/inactive fixture. Lines 82–83 explain CSRF access after a refusal
  removes the form. Lines 109–110 separate write checks from sign-in refresh.
  Lines 137–138 separate overview reads from access-resolution reads.
- administration-pages.ts:25: keeps the complete-read precondition explicit.
- hosted-browser.ts:23: explains null versus omitted Origin. Lines 28–30 state
  cookie, transport and redirect limits. Line 59 preserves raw duplicate-field
  requests. Lines 95–96 explain the public Host and unchanged headers over a
  loopback transport. Line 118 states the form reader's accessible-name and
  visible-field boundary. Lines 131–132 prevent diagnostics from exposing CSRF.
- pending-invitations-page.ts:3: states the narrow email/role projection; it
  does not claim to read provider state or every invitation fact.
- hosted-live/administration-server.ts:44–45: limits diagnostics to safe reports.
  Line 80 explains boolean-only secret checks. Line 102 states the deliberate
  session lifetime. Line 105 identifies actual rendered-form submission.
  Line 130 marks invitation tokens/links as credentials kept inside the test.

## Oversized files — four retained

- hosted-live/administration-server.ts: one provider journey owns its scoped
  fixtures, safe diagnostics and invitations; UI-04 migrates row reads only.
- hosted-member-removal-browser.runtime.ts: one selected gate contains fresh
  Members, invitation, removal and Audit regressions. Browser mechanics already
  have separate focused drivers; generic scenario plumbing would hide behavior.
- hosted-workos-administration.test.ts: the provider contract and role/refusal
  matrix share explicit fixture assumptions; only pending-row reads change.
- account-routes-administration-pages.test.ts: one public page contract keeps
  count/order, action, role, scope and escaping cases together. No arbitrary
  file split is needed to satisfy a line threshold.
