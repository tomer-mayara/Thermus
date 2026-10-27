# UI-04 native functional evidence before main rebind

Original candidate `07285735ff92af7dd35908d79e47460256cb8415`; parent `6ced8db3965190d1d859b60d7053f1830cf5a23c`; original main `2b3ad13b9e2e61e206479b82e91359192cae1d00`.

Historical archive for the upcoming verified rebind after main advanced to `9507e751215fec32748bf4e944f2393928e61cf5`. No execution is relabelled as a new-head run. No coverage, metrics, API, habit-hooks or checker result exists for this native UI-04 run; these await final new-head quality work. Linux AMD64 hosted image, selected hosted-live and human approval remain holds. No merge or deployment is claimed.

## Functional evidence

- [Final native summary](validation/functional-summary-07285735.json), [all results/count lines](review/result-count-index.json), [log checksums](validation/gate-log-sha256-07285735.json), [original pins](validation/pins-final.json).
- [Ordinary](validation/ordinary-final.log): 5,165 emitted + 49 portal cases passed. [Typecheck](validation/typecheck-final.log) and [portal build](validation/portal-build-final.log) passed.
- [Browser](validation/members-browser-final.log): 71 passed, [57 screenshots](validation/screenshots-final/), [bounded visual review](validation/browser-visual-review-final.json).
- [PostgreSQL](validation/postgres-final.log): 26 passed; [Collector](validation/collector-final.log): 10 passed; [self-hosted](validation/self-hosted-container-final.log): 11 passed.
- [Hosted offline](validation/hosted-offline-final.log): 3,319 unit + 29 portal unit + 20 remaining portal + 1,169 integration + 123 acceptance/interface + 13 renderer cases passed. All reported groups have zero failures/skips/todos. The required local AMD64 image remains separate and deferred.
- [Before inputs](validation/inputs-final-before.json), [after inputs](validation/inputs-functional-after.json): all 1,530 tracked hashes/modes match. No retries/failures in this native matrix. Gate cleanup completed, shared ports released and no owned test container remained. Broad final typecheck still needs refresh because tsconfig includes main's added scripts.

## Environment and historical provenance

Only JSON environment evidence is included: [private dependency copy](validation/environment/materialization-provenance.json), [source inventory](validation/environment/source-dependency-tree-inventory.json), [private inventory](validation/environment/dependency-tree-inventory.json), [Node alias normalization](validation/environment/node-alias-normalization.json), and [primary alias repair](review/primary-node-alias-repair.json). The actual old absolute-link node_modules directory, all package trees and raw V8 files are excluded. No .env/credential file is included.

Runtime bytes/version remain equal. No manual install, package-version, production source or repository configuration change is claimed. Shared node_modules must not be described as wholly untouched by tools.

[Source review](review/source-review.md), [inventory](review/current-increment-inventory.json), [architecture assessment](validation/architecture-assessment-final.json), [document review](review/docs-review.md), [main comparison](review/after-main-270-comparison.json). These retain original pins until independently verified final rebind. [Published 072 ancestry proof](review/source-review-publication-07285735.json) and [earlier original source ancestry](review/source-review-publication.json) preserve historical code links.

[Original UI-04 immutable evidence](https://github.com/tomer-mayara/Thermus/blob/efef59fd51f92ebe90eb655f2f8b29fe965debee/review-evidence/ui-04/3380afe663c6a2ef02a0adda525faccd6f5b726f/README.md) and [old PR body/comments](review/pr-before-268.json) retain the earlier 22/29 hosted-live failure: six quota setup failures and a separate unexplained reinvitation 503. Those old pins are historical; no UI-04 live attempt ran at 072 and no provider cause or final success is inferred.

No final new-head publication body is prepared. Packaging copied files only; no tests, builds, metrics, checkout, Git mutation, provider or publication action ran. [SHA256SUMS](SHA256SUMS) covers all files except itself. [Credential scan](review/credential-scan.json) checks configured private values and WorkOS key patterns without printing values; this is bounded evidence, not proof for every secret format.
