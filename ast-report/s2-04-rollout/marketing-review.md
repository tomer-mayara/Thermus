# Marketing PR 27: independent implementation review

Reviewed at 2026-10-24T23:39:23.932267+00:00.

**Signoff:** no implementation finding for the prepared policy candidate. This
agent review does not supply legal approval, human approval, or permission to
merge or publish. Keep PR 27 Draft until the owner approves the exact package
and publication scope; confirm or revise its date if publication is delayed.

## Pinned candidate and exact bytes

- PR: https://github.com/tomer-mayara/Thermus-Marketing/pull/27
- Base: `77328878f88c59ff499acb187f62e439bd670ee4`.
- Head: `1cd32b128698b95f624f0fed15ca3c58d95a62d0`.
- Worktree: `/Users/tomermayara/.codex/worktrees/marketing-s2-04/Thermus-Marketing`;
  clean and at that head during review.
- Complete diff SHA-256:
  `4d7613496af91e016f1f47b1843ff0b804e5d6e1010bb1dc00b0a9658669b4ef`.
  The retained `reports/s2-04-policy/complete.diff` is byte-identical to this diff.
- Canonical source: Thermus `docs/legal/organization-audit-2026-10-24-proposal-v3/`.
  Manifest SHA-256:
  `3469754d04e8a4237bf6079249d3bdcdf3279886464d53951942ebd9c88e4df0`.

| Document | UTF-8 bytes | SHA-256 |
| --- | --- | --- |
| Terms | 19,946 | `ce5f1afb9ac2759117b722a4d819b6207f23e2ff99f15d09a5abbd9e1b32eee3` |
| Privacy | 35,098 | `692801219c0ac19c50300cd188cfd2ca55cb7e89caaba656269e484b44d4dcc6` |

Both committed Markdown files equal their canonical source bytes. The Astro
page metadata and existing acceptance-test hashes match the manifest. The
retained `dist/` pages also expose those versions/hashes. All six changed files
were reviewed: two Markdown copies, two page metadata edits, the existing
rendered-policy test update, and the legal-content record. No route, layout,
JavaScript, dependency, build/deploy configuration, pricing, homepage, or product
guide changed. The old approved package remains unchanged in Thermus.

## Retained verification reviewed

`reports/s2-04-policy/check.log` records typecheck, 62 tests with 62 passes and
zero failures/cancellations/skips/todos, then a successful static build. Its
SHA-256 is `8d0cd90bf4aa2640d4ce74b19c7da085235b681d727cfef1fbef55576609229e`.
The existing test builds both local production and deploy-preview contexts and
compares complete visible text, punctuation, links, table cells, one H1, contents
anchors, date, metadata, unchanged legal paths, and email-obfuscation guards.
The diff retains these assertions; only candidate identities/date and descriptive
wording changed. The log reports 113.1 KB homepage gzip and 3.50 KB executable
JavaScript, within the existing budgets. These are retained author runs, not
checks rerun by this reviewer.

`reports/s2-04-policy/browser.json` SHA-256 is
`511855bc1d95a7f6f78764de5f1f5e283213ccfc28f5d96257b57e2eb843a9ad`.
It records both pages at 375 and 1280 pixels, matching versions/hashes, one H1,
no horizontal overflow, zero broken contents links, direct email links, and
unchanged footer destinations. Privacy has 12 table rows. The source record says
JavaScript was disabled. The reviewer inspected the retained Terms top captures,
Privacy Audit-section captures, and Privacy table captures at both widths. Text,
wrapping, and tables are readable; no clipping or overlap was observed. This is
scoped screenshot/evidence review, not a fresh complete browser or accessibility
run. No build or test was started.

## Publication state and evidence limit

Fresh GitHub readback confirms OPEN and Draft at the pinned base/head, with an
empty status-check rollup. The title and head commit message both contain
`[skip netlify]`. GitHub's deployments endpoint filtered to the candidate head
returns an empty list. The local npm scripts build/test files and invoke no
Netlify deployment command. No merge, deployment, or publication action was
performed by this reviewer.

A read-only request to `https://thermus.ai/terms/` returned HTTP 403. No successful
current public-content readback or Netlify deployment inventory was obtained by
this reviewer. Therefore the evidence supports the prepared/unpublished workflow
and shows no GitHub-recorded deployment of this head; it does not prove the
absence of every independent Netlify deployment or preview. Do not present local
HTML as published content. Owner approval, actual approved publication, slash
variants, Cloudflare/email behavior, and deployed-byte verification remain
separate release work.

## Thermus architecture follow-up

The manager has visually reviewed and accepted the scope of all six architecture
images: the L3 comparison and changed registry views 1, 2, 6, 7, and 13. The
current `architecture/v2/` review still pins a working candidate over base
`845cec3060b0880cd27c36047f1da57a1c3772ba`, not the final release commit. After
commit, refresh candidate/base provenance, diff/file hashes, comparison source
links, public declaration evidence, and classification. Reuse the accepted
renders only if the diagram sources remain byte-identical; rerender and obtain
manager review if their content changes. Agent review does not replace required
independent authorized human approval.
