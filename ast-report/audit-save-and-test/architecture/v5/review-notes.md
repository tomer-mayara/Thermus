# Architecture and technical review — v5

Final repaired candidate pin pending. Source candidate `869de8c5a3e70cea19aea3a4807633fb8d369cea` is superseded by a test/snapshot repair; its production design received an independent technical pass. Prior v4 pins/gates stay historical.

## Independent technical assessment

No production blockers found. Reviewed complete Save-before-Test behavior plus service read/Save token preview, validation/decryption/short-token masking, native blank placeholder, explicit Test whitelist, server-sourced saved marker, matching-revision reread, scoped scroll storage consumption/expiry/clamping, null-safe recovery script, native script-disabled and blocked-storage fallback, field-edit clearing and timer. Protected Admin/origin/CSRF/tenant/revision checks and unconfirmed-write no-form/no-send behavior remain intact. No raw credential or preview field is added to database records, audit metadata or sender destinations.

Reviewed new feedback acceptance/script tests, changed service projection expectations, Save 200 responses, failed-Save and changed-revision suppression, denied Admin preview/read/write/send case, and previous phase/security/runtime changes. Read Chromium proof and implementation evidence under `ast-report/audit-save-feedback/`: real native Save/Test at 1440/390/320, same before/after scroll, empty FormData token with prefix placeholder, replacement/short tokens, expiry without button movement, errors, no-JS and blocked storage. Manager approved desktop/mobile viewport screenshots and preliminarily reviewed source. Reviewer ran no build/full suite; complete-candidate gates belong to manager.

## Tier and contract meaning

T2 Need architect: changed web/audit runtime collaboration (`internalInterface`) and changed public declaration snapshot (fact d). `sensitiveBehavior` remains for credential visibility, data mutation and recovery. The optional preview changes observable contract meaning: authorized Admins can see a bounded prefix where previously only presence was exposed. It adds no authentication capability and never submits the preview. No separate supported external API, topology, external integration, component set or deployment change is identified.

## Comparison design and visual review

v1–v4 and prior pins remain historical. v5 incorporates direct Save response, feedback/scroll behavior and audit-owned public projection. Both web and audit owners are amber; surviving calls, SQL and HTTPS arrows stay neutral. This supplementary view is derived from code/prose; it is not a registry drawing or dependency declaration. No architecture element is added/removed, so there is no green/red item.

Parsed and rendered with cached Mermaid 12.2.0 and repository Playwright Chromium in an 800px panel, preserving native 18px text. Inspected PNG without zoom: title/boundaries/labels fit; neutral white edge backgrounds are clear; arrow targets are correct, with no crossed labels or unrelated boxes. Standalone source, SVG and PNG retained. Manager visually approved v5: legible labels, proper L2 boundaries and owner responsibilities, amber public projection owner correct, no crossings/overlap. See `manager-review.json`.

`behavior-notes.md` supplies four complete behavior notes, omitted context and strongest-contract/L4 rationale. The final main snippet will embed standalone Mermaid byte-for-byte plus exact declaration diff and pinned links after repair.

## Limits

This independent technical evidence is not independent authorized human architect approval. It does not establish complete gates, deployment or live destination receipt. Prior candidate gates are historical because production source and public projection changed. Refresh final pin after the repair commit.

## Final repaired candidate pin

Independent technical pass for clean `d167fff53aeece23e02b6811ec772f796f9712c2` against actual base `74f756562231fb6aafd6a87f4bbd0f02bc0a208e`. Compared repair against869de8c5: only a `tenant:string` callback annotation in hosted-save-feedback acceptance changed. Production source, registry and public declaration are byte-identical; existing v5 rendering and manager approval carry forward. The complete repair diff is retained as `repair.diff`. Final machine record: `provenance-d167fff53aeece23e02b6811ec772f796f9712c2.json`. No rerender was needed.

All13 registry Mermaid blocks retain exact base hashes. Eight source/registry/declaration files are copied at both pinned revisions, and all changed source/registry/test candidate hashes are recorded. The main snippet embeds standalone Mermaid byte-for-byte, then four behavior notes, L4 rationale and the exact optional-field declaration diff. GitHub source links below use the final head; line bounds were checked against committed files.

- [src/interfaces/web/account/logging-routes.ts:51–114](https://github.com/tomer-mayara/Thermus/blob/d167fff53aeece23e02b6811ec772f796f9712c2/src/interfaces/web/account/logging-routes.ts#L51-L114).
- [src/interfaces/web/account/logging-page.ts:19–65](https://github.com/tomer-mayara/Thermus/blob/d167fff53aeece23e02b6811ec772f796f9712c2/src/interfaces/web/account/logging-page.ts#L19-L65).
- [src/interfaces/web/account/logging-page.ts:76–85](https://github.com/tomer-mayara/Thermus/blob/d167fff53aeece23e02b6811ec772f796f9712c2/src/interfaces/web/account/logging-page.ts#L76-L85).
- [src/logs/audit/destination-settings-service.ts:10–18](https://github.com/tomer-mayara/Thermus/blob/d167fff53aeece23e02b6811ec772f796f9712c2/src/logs/audit/destination-settings-service.ts#L10-L18).
- [src/logs/audit/destination-settings-service.ts:92–118](https://github.com/tomer-mayara/Thermus/blob/d167fff53aeece23e02b6811ec772f796f9712c2/src/logs/audit/destination-settings-service.ts#L92-L118).
- [src/logs/audit/destination-settings-service.ts:150–158](https://github.com/tomer-mayara/Thermus/blob/d167fff53aeece23e02b6811ec772f796f9712c2/src/logs/audit/destination-settings-service.ts#L150-L158).
- [architecture/components.md:277–316](https://github.com/tomer-mayara/Thermus/blob/d167fff53aeece23e02b6811ec772f796f9712c2/architecture/components.md#L277-L316).
- [architecture/components.md:477–502](https://github.com/tomer-mayara/Thermus/blob/d167fff53aeece23e02b6811ec772f796f9712c2/architecture/components.md#L477-L502).

The initial869 candidate and earlier4ae gates are superseded. Manager reports canonical API generator0written/48unchanged and serial check48current after a transient stale result; that failed check remains in validation history. This reviewer performed no build or full suite. Final gates remain required on the complete repaired candidate.

## Final visual finding — placeholder contrast

After the core technical pass, reviewer measured the new token-preview placeholder in Chromium: `rgb(117,117,117)` on `rgb(23,24,29)`, opacity1, contrast3.85:1. Pinned d167 CSS has no `::placeholder` color rule; this newly displayed identifying hint is faint. Recommended one Audit-scoped explicit placeholder color using the existing secondary text color (`#B4BAC0`, opacity1). No behavior test is needed for this style-only adjustment. Reported to manager before editing; disposition pending. Core ordering, credential and recovery checks remain sound. If accepted, final source/provenance pin must refresh after its commit.

## Final contrast fix and independent sign-off

Independent technical pass for `e9e2185663f62690809640c5434ad24582843835` against `74f756562231fb6aafd6a87f4bbd0f02bc0a208e`. The only delta after d167 is one Audit token hint rule: `.logging-layout #logging-token::placeholder{color:#B4BAC0;opacity:1}`. New contrast is9.0523:1 on#17181D, up from3.8468:1. Reviewer independently checked exact pinned CSS and scope; implementation browser measurement and manager screenshot approval confirm the visible hint remains an empty input. The finding is resolved. Diff retained as `contrast-fix.diff`; browser CSS proof is `ast-report/audit-save-feedback/placeholder-after.json` and its1440 screenshot.

The behavior proof remains pinned to869de8c5, bridged by the exact subsequent type-only test annotation and CSS-only rule. Final provenance is `provenance-e9e2185663f62690809640c5434ad24582843835.json`, with source read only via `git show` during metrics. Copied final source is under `pinned-source-final/`; prior snapshots/pins stay intact. Other reviewed source/registry/declaration hashes match; changed source/test manifest refreshed. Main snippet links use final SHA and embedded Mermaid is byte-identical. Approved v5 rendering carries forward; no rerender needed. Manager also approved the contrast fix. Full final gates remain manager-owned.
