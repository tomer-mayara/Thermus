# Marketing policy review evidence

This evidence supports [Marketing draft PR 30](https://github.com/tomer-mayara/Thermus-Marketing/pull/30),
head `b07ea8836e3a8df1a8766af81846b25251915549`, based on Marketing main
`654eebabb6465967edf8d4b0388708e6421f0691`. The manager reviewed the six-file
candidate, then signed off the immutable approval-link update and local commit.
The commit title contains `[skip netlify]`. This evidence publication creates no
pull request or deployment and does not claim the policy candidate is live.

The owner approved bundle `s2502-organization-removal-proposal-2026-10-26-v1`
and its exact manifest SHA-256
`7528832b4e2baf055d4be35ec2d12fe3d00a9681d0a7684dc5f246e830c4071e`.
[Direct owner approval](https://github.com/tomer-mayara/Thermus/blob/7f2e22ff706c3c81da07ee70ec16bb7d6cf4a0ba/docs/legal/organization-removal-2026-10-26-proposal-v1/owner-approval.json)
is separate from publication and later runtime proof. All five approved source
documents and the manifest remain unchanged.

## Candidate and checks

- [Complete patch](candidate.patch), SHA-256
  `3bfeb184be02acd59051eaff63e7ba465202741157f092bb461728a2a2e230e2`.
- [Candidate record](candidate-review.json) gives the final six file hashes,
  versions, source byte checks, base, head, and final approval-link read.
- [Final locked install](npm-ci.log), [full check](npm-check.log), and
  [runtime versions](runtime.txt): Node 24.20.0, npm 11.19.0; 62 tests pass,
  zero failures/skips/todos, typecheck and build pass. The existing complete
  policy case checks both production and deploy-preview local builds.
- [Acceptance RED](acceptance-red.log) records the changed existing oracle
  failing on the old Terms source hash before exact source integration.
- [Browser facts](browser-facts.json), [browser log](browser-review.log), and
  [manual review driver](browser-review.cjs) record four local Chromium
  observations, JavaScript disabled, at 375 and 1,280 pixels. Complete visible
  policy text, hashes, one H1, anchors, direct email, and horizontal bounds pass.
  The existing policy test also compares every link and table cell.
- [Configured habit scan](habit-hooks-configured.log) and
  [temporary scan configuration](habit-config.toml) retain the findings.
  [The original default scan](habit-hooks.log) had no configured files; it is
  not treated as a completed scan. No snooze file was populated.

The existing rendering-test complexity and three comments are unchanged. The
comments explain why build finalization and a shared H1 matter. The complete
approved Privacy document exceeds 200 lines; splitting it would change the
approved bytes. These retained findings and their reasons are in the
[full authoring review](authoring-review.md). No callable code, dependency,
route, layout, renderer, or architecture boundary changes.

## Bounded visual review

These are the inspected screenshots. Full-page text checks cover the complete
documents; bounded images keep the review readable at normal width. They show
public policy material only. They are local observations and do not prove a
physical mobile device, deployed edge behavior, or a complete accessibility audit.

- [Mobile Terms header and date](terms-375-top.png)
- [Mobile removal section](terms-375-removal.png)
- [Desktop removal section](terms-1280-removal.png)
- [Mobile Audit disclosure](privacy-375-audit.png)
- [Mobile removal-record retention table](privacy-375-retention.png)
- [Desktop Audit disclosure](privacy-1280-audit.png)
- [Desktop retention table](privacy-1280-retention.png)
- [Desktop Privacy header and date](privacy-1280-top.png)

## Retry history and limits

The initial [install](npm-ci-initial-node22.log) and
[check](npm-check-initial-node22.log) used Homebrew npm's Node 22 despite the
shell node path. The check passed, but engine warnings required the final
explicit Node 24 rerun. The [first browser log](browser-review-initial.log)
records a wrong screenshot heading selector; it was fixed in the ignored
manual driver and all four observations rerun. No production change was needed.
The final dependency install notes an optional fsevents install-script warning;
no script approval or dependency change was made and all final checks pass.

The final documentation-link-only edit was read successfully at its immutable
GitHub ref and passed whitespace/fingerprint checks. Source, metadata, and test
hashes remained identical, so broad checks were not repeated.

[Artifact inventory](artifact-manifest.json) pins every published file by byte
count and SHA-256. [Secret-scan record](secret-scan.json) lists scope and limits.
Only this evidence directory is added over Thermus base
`9f07c04bba0813358274212b21316165dc3e308b` on the dedicated evidence branch.
Runtime files, credentials, node_modules, complete browser profiles, and
uninspected full-height screenshots are excluded. Local paths in logs identify
the authoring environment; they are not a claim of GitHub artifact availability.

The authoring review was written before the manager opened PR 30; its earlier
no-PR statement describes that time. The current PR state is stated above.
The manager owns Ready, merge, deploy, public readback, and remaining Slice 2.5
gates. Root validation evidence can be added later without changing these files.
