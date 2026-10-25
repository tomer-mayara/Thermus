# Manager architecture and source review

Reviewed candidate: `d75b8676cbbc37be2f69356d577ade1ffb87b783`. Actual parent: `122d65bf1f035fc195792cc083732aa05c423c58`.
Date: 25 October 2026. This is agent review, not the required independent human approval.

The manager reviewed the coordinator, current-fact checks, lifetime, durable
store, composition, migration, public declarations, tests, and independent review.
The stop-signal correction resolves the independent P2 finding. Each provider
read checks the server-owned signal; an existing transport request keeps its
normal bound. A started terminal SQL write can commit late for its own operation,
which is documented and distinct from a late provider answer starting new work.
No unresolved code defect was found. Full gates and final metric classification
are recorded separately; this review does not claim those checks passed.

All eight final PNGs in `renders-applied-v4` were inspected at normal 800-pixel
width, one image at a time. Titles, labels, boundaries, arrow targets, and crossing
placement are readable. The earlier broad diagrams were rejected because their
text became too small; shorter labels, wrapped text, edge order, and separate
local/hosted deployment views resolve that feedback. Stable topology is unchanged.
The two invisible layout links are marked in source and are not runtime calls.
Seven embedded registry sources match their rendered standalone copies exactly.

Registry SHA-256: `98ce7196e4413616270d8536d240f372518084341b989ba983616efe3adb1e32`.
The full inventory and renderer provenance are in `inventory-applied-v4.json` and
`renders-applied-v4/render-report-v2.json`. All 15 blocks were inventoried against
the parent's 13 blocks. Eight old blocks are byte-identical. Four old blocks
changed, deployment was split into two, and the removal view was added.

The main comparison is `comparison-v2.mmd`. The L3 owners and four behavior notes
answer the concrete review questions about admission, authority, matching
receipts, replay, and stopped read continuations. The new request/result/store
and optional directory signal contracts are explicit in the declaration diffs.
An L4 diagram would repeat private phase steps without adding an owner boundary;
it is omitted for that reason. Source type imports and runtime calls have opposite
directions here and are documented separately. The same pool, external WorkOS,
and PostgreSQL remain; no new container or source component pair is introduced.

S2.5-01c still owns the browser route and trusted customer Audit capture.
The source review does not authorize deployment, production migration, or merge.
Before publication, pin the final candidate and verify that these source and
render bytes still match. Keep the earlier draft reviews as history.
