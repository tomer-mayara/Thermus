# Compact workspace navigation: review evidence

Final candidate: 21228a7667b4e2d0eed264744687e3636649b17f.
Trusted merge base: a16a40c02ab5c697a757a9448d454147152de458.
Source candidate: 73cd02f296623d50aa81f78e596c399231e843d7.

The final branch also incorporates three documentation-only changes from main
and the required immutable base metrics records. Its source, tests, dependencies,
legal fixtures, and build settings match the tested source candidate.
The metrics and checker reports use the final candidate and the same base.
Coverage was collected from both selected unit groups, verified by the
repository tool, and reused after the document-only commit.

## Reports

- [Implementation checks, red steps, and retry history](navigation-validation.md)
- [Manager and independent review; all retained habit findings](navigation-manager-review.md)
- [Final review-tier checker](navigation-check.json)
- [Stamped impact declaration](impact.json)
- [Complete metrics process](process.md) and [machine report](process.json)
- [Metric review](review.md) and [machine report](review.json)
- [Function CRAP report](crap.json)
- [Verified unit coverage](coverage.json)
- [Base snapshot](snapshot-base.json) and [head snapshot](snapshot.json)
- [Initial full-suite log, with one deadline failure](navigation-npm-test.log)
- [Isolated startup retry](navigation-startup-retry.log)
- [Passing full-suite rerun](navigation-npm-test-retry.log)
- [Typecheck](navigation-typecheck.log)
- [Portal build](navigation-portal-build.log)
- [Hosted build](navigation-hosted-build.log)
- [Final habit-hooks output](navigation-habit-hooks-final.log)

## Browser evidence

- [Admin Connect, desktop](navigation-browser/connect-admin-on-1280.png)
- [Admin Connect, phone](navigation-browser/connect-admin-on-320.png)
- [User Connect, desktop](navigation-browser/connect-user-on-1280.png)
- [User Connect, phone](navigation-browser/connect-user-on-320.png)
- [Members, desktop](navigation-browser/members-layout-on-1280.png)
- [Members, phone](navigation-browser/members-layout-on-320.png)
- [Audit, desktop](navigation-browser/audit-controls-on-1280.png)
- [Audit, phone](navigation-browser/audit-controls-on-320.png)

The full browser runtime passed 75 tests. The images show keyboard focus
because the cases inspect real keyboard navigation. The manager inspected
both Connect roles, desktop and phone layouts, and the Members desktop view.

## Scope and history

Full ordinary tests, typecheck, portal/hosted builds, browser runtime,
container gates, habit-hooks, and metrics are selected by the source-change
policy. Hosted-live, PostgreSQL, and Collector gates are not selected: this
change alters no authentication/provider call, database, export transport,
or resource lifetime. The hosted build includes its existing renderer checks.

The initial ordinary run passed 5,166 of 5,167 compiled tests. One unchanged
startup deadline stopped at 5,237.7 ms against a 5,000 ms limit. The isolated
12-test startup run and the complete suite rerun passed without code, deadline,
or assertion changes. The passing rerun includes 5,167 compiled and 51 portal
tests. Earlier filtered test startup attempts and their passing full-file
replacements remain in the implementation history. No approval was requested,
given, or de-escalated for an earlier candidate.

## Final gate results and provenance

The hosted Linux AMD64 image gate passed 7/7 tests. The self-hosted container
gate passed 11/11. All selected executable checks passed.

- [Hosted image gate](navigation-hosted-image.log)
- [Hosted image offline build](navigation-hosted-image-build-progress.log)
- [Self-hosted container gate](navigation-self-hosted-container.log)
- [Self-hosted image build](navigation-self-hosted-image-build-progress.log)
- [Exact tested-input equivalence after the documentation update](navigation-candidate-equivalence.json)
- [Prior d3e9ba9e reports against 57d9ce05](navigation-history/d3e9ba9e/)

The rebase conflict was limited to .pr-impact.json; the menu declaration was
retained for this increment. No test, deadline, source file, or runtime image
input was changed after the passing gate runs. The checker reports no GitHub
checks or statuses for the current candidate; this repository uses local gates.
