# Exact-byte owner review: Slice 2 Audit notices

Status: **unapproved**. Proposed effective date: **24 October 2026**. Review
readback: `2026-10-25T00:08:14Z` (24 October in America/Denver).

Candidates: [Thermus PR #248](https://github.com/tomer-mayara/Thermus/pull/248)
and [Marketing PR #27](https://github.com/tomer-mayara/Thermus-Marketing/pull/27).
Marketing head is
[`1cd32b128698b95f624f0fed15ca3c58d95a62d0`](https://github.com/tomer-mayara/Thermus-Marketing/commit/1cd32b128698b95f624f0fed15ca3c58d95a62d0).
Read-only GitHub inspection found both PRs in Draft with no status-check entries.
Thermus's last committed PR head is `a7bdf1f32bb2d67e87d85ea03a701078ec04808b`;
the byte verification below covers the current prepared working-tree candidate.
The manager binds the complete source checks and review to its final commit.

## Exact material to review

Bundle: `s204-organization-audit-proposal-2026-10-24-v3`, purpose
`organization-creation`. Read the complete [proposal package](../../docs/legal/organization-audit-2026-10-24-proposal-v3/README.md),
[manifest](../../docs/legal/organization-audit-2026-10-24-proposal-v3/manifest.json),
and [source/data-flow review](../../docs/legal/organization-audit-2026-10-24-proposal-v3/data-flow-review.md).
Current manifest SHA-256:
`9ff7e5f5fa48bad17dcf5cde7248aa226700e2b10f3eb9da26a1de42c6f90075`.

| Complete file | Version | UTF-8 bytes | SHA-256 |
| --- | --- | --- | --- |
| [Terms](https://github.com/tomer-mayara/Thermus-Marketing/blob/1cd32b128698b95f624f0fed15ca3c58d95a62d0/src/content/legal/terms.md) | `hosted-terms-organization-audit-proposal-2026-10-24-v3` | 19,946 | `ce5f1afb9ac2759117b722a4d819b6207f23e2ff99f15d09a5abbd9e1b32eee3` |
| [Privacy](https://github.com/tomer-mayara/Thermus-Marketing/blob/1cd32b128698b95f624f0fed15ca3c58d95a62d0/src/content/legal/privacy.md) | `hosted-privacy-organization-audit-proposal-2026-10-24-v3` | 35,098 | `692801219c0ac19c50300cd188cfd2ca55cb7e89caaba656269e484b44d4dcc6` |
| [Agreement](../../docs/legal/organization-audit-2026-10-24-proposal-v3/agreement.txt), unchanged | `hosted-agreement-organization-proposal-2026-10-23-v2` | 378 | `279cb2f3005131618bcf7f3ea755ad09205dca3c490f2c3de0c70b25e1ef2a9a` |
| [Audit help](../../docs/legal/organization-audit-2026-10-24-proposal-v3/audit-help.md) | `hosted-audit-help-proposal-2026-10-24-v3-r2` | 1,929 | `1f4ad87cb93356115e2626f493d2f28040ab80ed94bd8353a3870efe4a27de4d` |

A direct manual byte comparison, without builds or new tests, found the runtime
Terms/Privacy/agreement equal to the proposal and manifest. Terms/Privacy also
equal Marketing's working files and the exact committed head above; its wrapper
versions/hashes match. The agreement equals the earlier approved source. All
12 static help paragraphs match the rendered source UI in order, with both
manifest-defined token-presence prefixes handled separately. Help placement
headings and excluded controls remain as the manifest states. Logging-page
source hash remains
`058b8a70e911cf25a67c20d11b14ddfcf084416cbb0ab45e71f8578b80554189`.
[Byte-comparison facts](legal-byte-verification.json) retain the details.

## Concrete disclosure changes

These are factual source/data-flow differences, not legal advice:

- Defined page-fetch/search completion and pipeline operator records omit
  request/result content. The text does not promise that every error, provider,
  or operational log is content-free.
- Optional organization Audit export can send validated tool inputs and final
  public results/errors, actor/organization/operation metadata, and supported
  invitation actions. Save/Test payloads omit saved destination details and
  credentials. Recognized redaction has limits; returned free text can retain
  secrets. Export result/event limits are 65,536/131,072 bytes; truncation affects
  the export copy. Delivery can lose or duplicate events, with no audit history
  or replay.
- An authorized Admin selects one HTTPS OTLP recipient. Supabase stores private
  destination settings and the encrypted optional credential. Direct Axiom
  sends the optional saved dataset as `x-axiom-dataset`, outside the event
  payload, with the configured endpoint and Bearer credential. Destination
  access, retention and onward sharing remain the organization's responsibility.
  Test is optional, can run while disabled, and proves neither future delivery
  nor durable storage.
- Per the owner's existing decision, **Slice 2 runs without settings backups or
  restore**. Loss can require Admin re-entry. Backup/custody/key-recovery work is
  future Slice 4 work and is not added as a Slice 2 prerequisite. Fees, liability,
  jurisdiction, the existing agreement rule, and unrelated disclosures remain.

## Publication, runtime and existing-organization scope

The proposed public scope is complete replacement at `https://thermus.ai/terms/`
and `https://thermus.ai/privacy/`. The runtime scope is the same complete Terms
and Privacy in hosted organization creation, the unchanged unchecked agreement
wording, recording the new document versions/hashes on new acceptance, and the
visible Audit help/Axiom field. The previous approved bundle and historical
acceptance evidence remain unchanged. Local UI review is in
[the corrected screenshots and facts](ui/v2/review.md).

The controlled rollout concerns the **existing internal Thermus AI organization**,
`org_01M5N95EJA1AKHHERCD7971AJ7`. The dated ledger identifies one active verified
password Admin and one User, with an accepted invitation. The selected Axiom
dataset is the existing `audit-log-test`; no customer Collector exists. The local
production-sender canary and observed Axiom marker prove one receipt, not the
complete deployed Admin/browser/MCP journey. The ledger records zero saved or
enabled destinations after cleanup and no Save/Test/Enable in the deployed
Admin read. These are dated observations, not a fresh live read by this note.

Posting policies, signing in, accepting an invitation, and the owner's earlier
rollout authorization do not themselves replace that organization's existing
agreement or record new acceptance. The existing manifest asks the owner to
select any required existing-organization notice/agreement handling before
export is enabled; this note prescribes no new checkbox or consent procedure.

## Pending status and existing owner decision

The manifest still has `approval: null` and `publication_date: null`. The v3
policies have no public publication/readback proof. Marketing PR #27 remains
Draft with `[skip netlify]` in its title and commit; no publication/Ready/merge
was performed. The ledger's current deployed source remains the approved main
`845cec3060b0880cd27c36047f1da57a1c3772ba`, without this new Axiom/notice candidate.
Historical v2 public verification is retained and does not verify v3.

Under the existing manifest/notice policy, the owner decision covers the complete
identified bytes, manifest, versions/hashes, effective date, public/runtime scope,
actual data flows and no-backup scope; current provider/destination facts and
recipient access/retention/onward-sharing; and any required handling for the
existing internal organization. If publication/opening is delayed beyond the
proposed date, follow the manifest's existing date/version/hash/approval rule.
Separate current-candidate human/source review and the remaining S1/S2 deployed
checks stay in the rollout ledger. This note adds no approval requirement and
claims none is satisfied by its preparation.

## Final review candidate

Runtime and help candidate: `85206b1c22dab78e8379d7a10e2f2b9ac31af9c6`; trusted base: `845cec3060b0880cd27c36047f1da57a1c3772ba`. Marketing remains `1cd32b128698b95f624f0fed15ca3c58d95a62d0`. The complete identified legal bytes, versions, hashes and manifest remain unchanged. Status-only README/data-flow notes now describe prepared unmerged source accurately. Final ordinary, type, portal, image 7/7 and live Staging 28/28 checks passed. Staging uses test documents; no new production v3 acceptance is claimed. Current-head human approval, exact-byte owner approval and publication remain pending.
