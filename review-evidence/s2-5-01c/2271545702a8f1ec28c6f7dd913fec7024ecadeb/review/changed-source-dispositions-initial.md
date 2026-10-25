# S2.5-01c changed-source dispositions

## Scope and provenance

This review compares the actual stacked parent `0ff3f6cdde5be4124df0ed2ab002844d5db1c502` (S2.5-01b) with the existing static snapshot at `cd7ccf3a3b543ad94bf9fe9d88a205b93f84bcf4`. It covers all 11 production files changed by the 01c increment. Current source bytes still match that head and the frozen source from `69d0c9b0`; the three later test-only fixes are uncommitted at this review. The manager will bind final evidence to the final commit.

Inputs are `ast-report/snapshot-base.json` and `ast-report/snapshot.json`. They report tool `0.43.1-thermus.1`, Node 24.20.0, TypeScript 7.0.2, and `own-characters-1` measurement. Exact report hashes, source hashes, recorded provenance, and dirty paths are in [the companion inventory](changed-source-dispositions.json). No metric server, build, test, or source edit ran for this review.

These are **parent-to-01c** measurements. The complete-candidate process against `origin/main` also contains the earlier 01a/01b source changes and their retained dispositions. Do not present those inherited full-stack changes as new 01c work. No final CRAP result is claimed: the manager must collect compatible coverage and run the parent-bound CRAP check. Snapshot provenance naming the unit suite does not prove coverage of each new function.

## Exact static measurements

MI values below are the snapshots' raw numbers, without rounding. Max paths is the largest reported function path count in that file; it is neither file MI nor a CRAP score.

| Production file | Parent MI → head MI | Maximum function paths, parent → head |
| --- | --- | --- |
| `src/accounts/organizations/administration-overviews.ts` | 75.7988076418376 → 76.8504719500318 | 3 → 3 |
| `src/accounts/organizations/membership-removal-checks.ts` | 56.89018621554175 → 61.01765055781432 | 9 → 9 |
| `src/interfaces/web/account/account-form.ts` | 61.60432516158119 → 59.83653028823848 | 6 → 6 |
| `src/interfaces/web/account/account-pages.ts` | 73.88014231968071 → 72.76076629466495 | 2 → 2 |
| `src/interfaces/web/account/account-routes.ts` | 60.07546058335585 → 59.440789019914476 | 6 → 6 |
| `src/interfaces/web/account/administration-pages.ts` | 64.89901264910168 → 61.87704640311736 | 3 → 3 |
| `src/interfaces/web/account/administration-routes.ts` | 56.14187606413681 → 51.26721230018643 | 11 → 11 |
| `src/interfaces/web/account/members-style.ts` | N/A → N/A | N/A → N/A (no functions) |
| `src/logs/audit/audit-event-projection.ts` | 36.99712939607105 → 35.19477522487573 | 13 → 13 |
| `src/logs/audit/audit-log.ts` | 88.05501787852491 → 88.05501787852491 | 3 → 3 |
| `src/logs/audit/otlp-audit-encoding.ts` | 54.626113259105146 → 54.323868501496115 | 15 → 16 |

Every file existed in the actual parent. Nine measured files remain below the file MI goal of 85; `audit-log.ts` is above it and `members-style.ts` has no executable MI. No new-file MI exception is required for these existing files. Retention rests on the responsibilities and safety boundaries below, not on their age. The inherited membership-removal-checks exception remains unchanged and is distinguished from a new exception.

## Manual owner review

### `src/accounts/organizations/administration-overviews.ts`

Member overview projection. The added removable field is a frozen display hint based on the same target-support predicate that removal rechecks. memberEntry remains one path. Existing role filtering, complete pages, and once-per-membership seat counts stay together because they describe the same current overview. Retain the file below 85: splitting these related projections would separate the displayed roles and eligibility from their shared member facts without reducing decisions.

### `src/accounts/organizations/membership-removal-checks.ts`

Current membership safety rules. The shared removalSupported predicate has four paths and preserves ordinary/active/all-known-grants semantics. targetRefusal falls from eight to five paths; checkRemoval stays at nine. It still owns actor/target rechecks, complete bounded member pages, and the last-Admin rule in their required order. Retain the file below 85 because per-guard modules would hide the safety sequence and direct-versus-paged target comparison. This file exists in the actual parent. Its unchanged inherited MI exception has bound 56.89 and expires 2026-12-24; the head score improves above that bound. No new-file exception is added for this increment.

### `src/interfaces/web/account/account-form.ts`

Bounded native-form parsing. memberRemovalIn has three paths and reuses the existing exact-once fields, CSRF-first check, ASCII field bounds, and bounded body reader. It returns only organization ID, membership ID, and revision. The existing return-path and invitation validators remain the maximum at six paths. Retain the file below 85: these parsers share one untrusted-form boundary, and a second removal parser layer would duplicate its accepted-input rules.

### `src/interfaces/web/account/account-pages.ts`

Fixed account notices and read-only recovery. removalResultPage has two paths; the result vocabulary is fixed data. Applied, refused, busy, and unknown remain separate and each uses read-only links. It performs no Members read, session mutation, or replay. Retain the file below 85 because a table of distinct required outcomes is clearer than a dynamic notice builder or flash/status storage. The strings affect file volume while executable branches remain small.

### `src/interfaces/web/account/account-routes.ts`

Existing session and current-access routing. Only the two-line invitation-only comment becomes one current administration comment. Function token bodies/signatures and path counts are identical in both snapshots. The raw MI changes with the comment/line contribution, not a behavior change. No new maintainability defect or runtime path is introduced here. The existing owner keeps cookie effects, checked tenant dispatch, and identity-only selection together; do not split runtime code for this prose correction.

### `src/interfaces/web/account/administration-pages.ts`

One native Members page. The page adds an escaped details/summary confirmation and a one-path removalForm. Cancel is a GET link. The member-row callback gains the removable display condition; the file maximum remains three paths. Retain the file below 85: the longer HTML is explicit, uses existing form/escape helpers, and needs no script, modal framework, or duplicated page state. Form rendering remains separate from write authority.

### `src/interfaces/web/account/administration-routes.ts`

Checked browser administration and trusted Audit capture. The new removeMember route has seven paths: method, origin, bounded form, checked organization, one coordinator call, and explicit unknown recovery. It never reads Members after the write. keep rises from six to seven paths for the membership target; the unchanged invitation changeOnPost remains the file maximum at eleven. Retain the file below 85: this owner already holds trusted actor/tenant scope and capture isolation. A new removal router would duplicate or expose that boundary. Keeping removal separate from the existing invitation result state machine preserves its durable uncertainty semantics. The raw MI decrease is 4.87466376395038, below the five-point informational threshold; the decrease is still recorded here.

### `src/interfaces/web/account/members-style.ts`

Members page layout data. This module exports CSS text only. Both snapshots have zero functions and zero paths and omit executable MI. MI is N/A, not zero. The edit adds confirmation styling and a member-identity layout using the existing stylesheet/CSP owner. Browser geometry and keyboard verification are separate evidence; static executable metrics cannot establish them.

### `src/logs/audit/audit-event-projection.ts`

Customer event allowlist and projection. projectAdministrationChange falls from eleven to eight paths. The new eleven-path administrationTarget has three flat cases: email for invite, invitation ID for invitation updates, and membership ID for removal, each with bounded metadata validation. The existing tool inputOf remains the maximum at thirteen. Retain the low file score because explicit accepted shapes and credential-safe named-field projection are the contract; a generic object serializer or broad mapping would weaken it. The helper isolates target-kind selection without scattering shared timestamp/identity validation. New busy, last-admin, and unavailable outcomes are accepted only as fixed vocabulary.

### `src/logs/audit/audit-log.ts`

Stable best-effort capture facade and event contract. Only the AdministrationChange action/target type vocabulary expands. The constructor and all three capture methods keep identical token bodies/signatures and path counts. The raw file MI stays above 85. Existing synchronous capture and failure isolation continue to prevent export failure from changing or replaying administration.

### `src/logs/audit/otlp-audit-encoding.ts`

Explicit OTLP event translation. eventAttributes rises from fifteen to sixteen paths for target.membership_id; other functions and payload/number/byte checks are unchanged. Retain the file below 85 because it translates one finite Audit event union into named OTLP attributes and preserves per-event validation. Moving the third target choice to a separate helper solely to lower this function count would not reduce the required decisions. It must not serialize arbitrary caller fields.

## Remaining metric evidence

Final function CRAP and coverage mapping remain pending. The static path counts identify review focus—especially the new seven-path route, eleven-path target projector, and changed sixteen-path OTLP encoder—but cannot substitute for measured coverage. Function-local MI values are not the file-level MI goal. No source split, exception expansion, threshold change, or unmeasured CRAP pass is proposed.
