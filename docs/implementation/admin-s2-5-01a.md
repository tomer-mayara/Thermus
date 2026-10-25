# S2.5-01a implementation record

Date: 25 October 2026. Status: implemented. See the current validation and review
in [PR #251](https://github.com/tomer-mayara/Thermus/pull/251).

## Scope and behavior

This ticket implements the [provider boundary](../design/organization-admin-plan.md#s25-01a--narrow-provider-deletion-and-current-target-facts).
It adds `OrganizationDirectory.deleteMembership(id)` and portable membership
management evidence. It adds no route, UI, coordinator, database operation,
MFA feature, or role writer. S2.5-01b owns admission, current authority, and
last-Admin protection. S2.5-01c adds the checked browser action.

`OrganizationMember.management` is `ordinary`, `external`, or `unknown`.
The WorkOS adapter maps only explicit `false` to ordinary and explicit `true`
to external. Missing or malformed evidence stays unknown. The revision includes
this normalized value along with the existing update time, status, and sorted
role slugs. The directory retains every grant, including permissionless roles.
The pinned SDK defaults a missing or null wire field to false. To avoid that
loss of evidence, `workosMembershipReads()` uses the same client's raw GET
method and maps the needed fields before that default. Hosted composition binds
this required reader. Each membership read still makes one request, with the
same filters, order, cursor, limit, and path encoding.

Deletion sends one exact membership ID to the existing WorkOS SDK client.
Normal `Promise<void>` resolution reports `applied`. Only HTTP 422 with code
`organization_membership_directory_managed` reports `unsupported`, which means
the provider proved no effect. Every other failure throws unchanged; its effect
is unknown. A missing record or a later read does not convert that failure to
success. The shared client still has zero automatic retries and a five-second
timeout. There is no new global account, authenticator, role, or status writer.

These rules follow the pinned [WorkOS Node 11 method](https://github.com/workos/workos-node/blob/v11.0.0/src/user-management/user-management.ts#L1192-L1205)
and [membership API contract](https://workos.com/docs/reference/authkit/organization-membership),
checked on 25 October 2026.

## Acceptance-first and TDD evidence

1. Write the acceptance cases before source changes. After dependencies were
   installed, both cases failed because management evidence was absent. The
   fixture's factor read was corrected to the pinned SDK method before recording
   this behavior failure.
2. Preserve the 28 passing member characterization cases. Add management and
   revision checks: the focused run had 30 passes and nine failures. Add the
   normalized evidence and revision input; all 39 cases pass. The acceptance
   run then passes one case and fails one on the absent deletion method.
3. Write nine deletion unit cases. All fail on the absent method. Add the narrow
   SDK call and outcome mapping; all nine pass. Both first acceptance cases pass.
4. Extend the production-client wire regression. A local HTTP service observes
   one DELETE for normal completion, the documented refusal, and a lost socket
   response. The source adapter also respects the existing five-second timeout.
   All six connection cases pass; the retry/timeout configuration needs no edit.
5. Add acceptance cases for a refused external membership and a deletion applied
   before its reply is lost. The former retains the target; the latter throws
   with an uncertain effect even though a later read finds it absent. All four
   acceptance cases pass. A clean compiled focused run passes 58/58 cases, and
   the additional affected provider/administration regressions pass 135/135.
6. Independent review found the SDK's missing/null default. Add real-wire
   acceptance cases first: four pass and two fail because unknown evidence
   becomes ordinary. Add a focused reader test, which fails on its absent
   export. Add the raw reader and explicit composition binding. The six
   acceptance cases and the focused reader/mapping tests pass. A clean compiled
   run passes all 246 selected new and affected cases. Independent review then
   confirms the correction and finds no remaining code or test issue.

The first execution attempt failed on missing local dependencies, not behavior.
Direct TypeScript execution of the connection test met an existing parameter
property limitation; its compiled run passed. Neither setup failure is a red
test proving the requested behavior was missing.

## Review and validation

The results in this section describe original head `122d65bf1f035fc195792cc083732aa05c423c58`. They are historical evidence after the rebase below. The maintained PR comments record fresh checks for the rebased candidate.

The source change requires the full ordinary suite, type checking, portal build,
applicable container and hosted gates, habit-hooks, current declaration snapshots,
and the source metrics process. The PR's maintained Validation and Quality review
comments record the final candidate, results, failures, and blockers.

The corrected candidate passes the full ordinary suite: 4827 backend cases and
49 portal cases, with no failures or skipped cases. Type checking, the portal
build, declaration snapshot checks, and all 28 live WorkOS password-profile
cases pass. The live run includes the changed membership-reader compositions;
it does not exercise the new deletion method against live WorkOS.
The hosted Linux AMD64 image passes all seven cases. Its clean image build also
runs and passes the complete hosted offline build, including the renderer gate.
The maintained PR comments record the separate self-hosted container result.

An initial full suite passed 4815 backend cases and 49 portal cases before the
review correction. That result does not validate the corrected candidate; its
full suite was run again. This history preserves the earlier result without
treating the missing regression as evidence that the first version was correct.

All 17 added or changed functions pass the CRAP goals. The metrics process still
reports low file maintainability in the existing provider and composition files,
and a high finding in the expanded connection test. The PR review records the
reason for each retained finding. No new production file or metric exception is
added. The API snapshot check passes; declaration-only diagnostics in two
unchanged, unlisted modules do not affect those snapshots. Full type checking
also passes.

The public directory declaration changes. Independent human architect approval
is required before merge under the repository policy. The existing component
set, dependencies, registry diagrams, and deployment remain unchanged. The
existing hosted composition now binds the raw membership reader. Registry prose
records that binding and the new unused deletion boundary.

## Evidence limits

The acceptance and wire cases use the real source adapter and pinned SDK with a
controlled HTTP service. They do not prove live WorkOS deletion behavior. S2.5-02
retains the scoped live provider proof and release checks. This ticket exposes
no customer removal action and makes no globally exactly-once claim.

## Rebase on 25 October 2026

PR #251 was rebased onto main `581f30cfaa32b01399422b087b0f0bdc3b800f70`.
The hosted composition keeps both the raw membership reader and the upstream
profile lookup used for Audit actor names. The connection tests keep both the
profile response-body timeout case and the membership deletion cases. The plan
keeps the current internal rollout status and all expanded Slice 2.5 tickets.

The impact declaration describes this PR only. All 13 registry diagrams remain
unchanged from the new base. The metric record for `9d0546b9` is the exact file
from main; its duplicate candidate commit was dropped. No new product behavior
was added during conflict resolution. The later stacked branches were not rewritten.

The combined conflict checks pass 41 cases, and the changed-test selection passes
181 cases. The fresh ordinary suite passes 4906 backend and 49 portal cases; type
checking and the portal build also pass. The maintained Validation comment records
the live and container gates, coverage, failures and retries for the final candidate.
Quality review records current metrics, the architecture comparison and remaining
human approval. These checks do not release removal or supply architect approval.
