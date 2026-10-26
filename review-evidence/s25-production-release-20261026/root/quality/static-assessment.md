# Static quality assessment

Candidate 7f2e22ff706c3c81da07ee70ec16bb7d6cf4a0ba; merge base 9f07c04bba0813358274212b21316165dc3e308b. Explicit Node v24.20.0; ast-metrics 0.43.1-thermus.1. Both snapshots passed. No tracked file changed during this work; the pre-existing user file was not touched.

## Changed production files

- src/accounts/providers/workos/workos-organization-removal-documents.ts: MI N/A -> N/A; functions new -> 0.
- src/app/hosted-workos-application.ts: MI 56.15 -> 56.15; functions 12 -> 12.
- src/interfaces/web/account/administration-help-documents.ts: MI N/A -> N/A; functions new -> 0.
- src/interfaces/web/account/administration-pages.ts: MI 61.88 -> 61.31; functions 14 -> 15.
- src/interfaces/web/account/logging-page.ts: MI 64.99 -> 64.32; functions 2 -> 3.
- src/interfaces/web/account/members-style.ts: MI N/A -> N/A; functions 0 -> 0.

The two added frozen-data modules and existing style constant report no functions and no raw MI; their complete snapshots establish N/A. They do not need invented numeric evidence or an MI exception. Existing hosted composition MI is unchanged. Administration pages drops 0.56 and logging pages drops 0.66. They remain low because each page owns compact escaped markup and its existing form rules; keeping one fixed help render at each page adds no form/authority complexity. The only new functions are the two one-path heading-shift callbacks. The existing logging-page MI exception remains unchanged/unexpired; no new exception is proposed. These inherited production low scores and small drops are retained with the reasons above. Fresh CRAP/coverage remains pending.

## Clean review findings and dispositions

- High: Members browser acceptance file MI 40 -> 33. Retain: it now proves full native help at narrow/desktop widths and Audit with scripts disabled while keeping the existing exact removal keyboard path in one focused browser fixture. Test files have no file-MI goal; this is a retained finding note under trusted rules.
- Medium: frozen successor WorkOS document module 351 LOC > 150. Retain complete approved Terms/Privacy/agreement bytes together, following the existing validated frozen-bundle pattern. Splitting approved prose cannot simplify production decisions; there are no functions.
- Low: administration-pages outgoing imported-name count 11>10. Retain the fixed web-owned help record and existing permitted micromark renderer; no new component edge or arbitrary-input API.
- Low: hosted-members acceptance Halstead bug estimate 1.04 -> 1.30. Retain direct complete semantic copy, metadata, form isolation and no-invitation-write assertions in the existing real hosted page scenario; this estimate measures added specification volume.

The first review included ignored local .cache scripts/historical source snapshots. Original evidence is retained; a clean detached candidate review removed that environment noise without changing rules/configuration or editing reports.

## Architecture impact and policy answers

Production architecture is unchanged. All 15 registry Mermaid blocks are byte-identical to base; inventory is in static-provenance.json. Checked context, hosted containers/auth/removal components, composition/ownership, member-read scenario, deployment and resource lifetime text. The registry prose now names the selected bundle/help owner. Existing app-to-WorkOS composition supplies a new frozen record; web imports its own help data and already permitted micromark. No public-surface membership or declaration, component, edge, provider, storage schema, role, session/admission, removal lifetime or deployment topology changes. No production callable contract changed; L4 is omitted. No lasting architecture decision is made; no ADR is needed.

Policy/check enforcement: no check, reviewer authority or merge rule changed. The policy team flag conservatively declares the exact owner-approved notice/acceptance scope; it cannot waive current-head code review. User-visible result: complete successor Terms/Privacy and version/hash recording apply only to a new explicit creator agreement; existing acceptance records and invitation/sign-in behavior stay. Full fixed help is native, closed and outside forms. New third-party code: none; existing micromark is reused. Image/runtime/data: five canonical test fixtures join the Docker build context and fixed approved strings join compiled source. Runtime still reads no Markdown file. There is no candidate database write/migration or runtime data format change. Recovery can use the retained prior application image while preserving accepted document histories and existing acceptance records; public publication/notice recovery must follow the approved release plan, without fabricating or rewriting agreements. Trust/permissions: unchanged current authorization, exact-target removal, CSRF, origin, provider and replay guarantees; micromark raw HTML/dangerous protocols remain disabled.

T1 minimum applies for Docker deploy/build input and declared team flag. Final checker, full candidate selected gates and required current-head independent human approval remain separate. No current-head approval is inferred by this agent review.
