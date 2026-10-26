# PR255 live verification

Candidate `1a3e5a6638d71e03485e0280848ee5e025335382`, merge base `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`, main at execution `e61da534d428169936e80f2bdaebe081c902aee0`. The full hosted live command passed 29/29, and the sequential Public Connect pair passed 2/2. Both exited 0 with zero failures, cancellations, skips and todos. All 53 journaled root resources returned 404 in exact-ID readback.

The external guard kept all original list results and allowed SDK calls. It rejected zero deletes. Original source, tests and SDK files stayed unchanged. Only normal build output was produced. The provider settings were read only.

[Manager review](manager-review.json), [final binding](final-binding.json), [input hashes](input-hashes.json), [hosted results](hosted-live/README.md), [Public Connect results](public-connect/README.md), [guard review](guard-review.json).

[Earlier accepted offline/quality evidence and retained failures](https://github.com/tomer-mayara/Thermus/blob/a492faebe3e48987c079b5a6c7665307f4cd17dd/review-evidence/pr255-merge-20261026/1a3e5a6638d71e03485e0280848ee5e025335382/README.md) remain at their actual execution pins. The new passing runs do not establish why earlier runs failed. The original TAP-only wrapper result is retained; this evidence independently reads Node spec totals without rerunning tests.

PR255 is eligible for integration. No merge is claimed in this snapshot. Keep Render Auto-Deploy Off. Production migration, notice/legal approval and deployment remain separate.
