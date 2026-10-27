# UI-04 review evidence

Candidate 3380afe663c6a2ef02a0adda525faccd6f5b726f in
[PR #268](https://github.com/tomer-mayara/Thermus/pull/268), stacked on UI-03
12d1a3c5b7cab197fa828ef89b7f650f918a7ea2. UI-02 is a sibling and absent.

- implementation/report.md: BDD/TDD red and green history, focused/browser runs,
  consumer inventory and screenshot observations.
- validation/manager-review.md: final manager sign-off, complete candidate
  results, provenance, metric findings and Draft limit.
- validation/independent-review.md: independent review, file pins and detailed
  non-null assessment. Agent review is not human approval.
- validation/staging-diagnostic.md: the required live failure and cleanup limits.
- validation/checker-result.json: preliminary T1 classification, not final merge
  authorization. All semantic impact flags are false and architecture is unchanged.
- validation/habit-dispositions.md: every retained hook finding and its reason.
- ast-report/process.md and JSON reports: complete metrics, source/import limits,
  coverage provenance, unchanged findings and history. Raw V8 files stay local;
  the verified capture manifest and mapped coverage remain in this bundle.

All local functional and container checks passed. Staging passed 22/29; WorkOS's
sandbox invitation-email quota and a separate unconfirmed reinvitation HTTP 503 remain
unresolved. PR #268 stays Draft; independent owner/team approval of the current
head is also required before merge. No merge or deployment is claimed.

The functional runs began at scope commit 474ae117 with the completed working
files. inputs-before.json and inputs-committed.json prove that their 923 recorded
inputs match the final candidate. Every result log preserves its original time
and exit status, including intended red steps and the browser setup correction.
The container build history and full offline log identify the exact current
Linux AMD64 build. SHA256SUMS inventories the published evidence.

[UI-03 historical evidence](https://github.com/tomer-mayara/Thermus/tree/edbac6608e109dd11445d8a6cd98befbf0b018b5/review-evidence/ui-03/12d1a3c5b7cab197fa828ef89b7f650f918a7ea2)
keeps the parent's full run and later quota diagnostic separate. It is history,
not a current UI-04 gate pass. No provider reset time is claimed.
