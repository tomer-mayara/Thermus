# Slice 2.5 stack merged

All five approved Slice 2.5 pull requests are merged into main. The final main revision is `9f07c04bba0813358274212b21316165dc3e308b`. Its tree `777542744c4cedf71e32c0cb38d88771df128f5f` exactly matches tested PR257 head `e46c506811b8639f691304c423f4af5fe894955e`.

| PR | Merge commit |
| --- | --- |
| [251](https://github.com/tomer-mayara/Thermus/pull/251) | `3d271bbae20b3d2ed91751fb77c10f6ead4bed99` |
| [253](https://github.com/tomer-mayara/Thermus/pull/253) | `0c9bfbda706397d4df8834f1d9d441a394f051ae` |
| [254](https://github.com/tomer-mayara/Thermus/pull/254) | `e61da534d428169936e80f2bdaebe081c902aee0` |
| [255](https://github.com/tomer-mayara/Thermus/pull/255) | `83281acfaff309ab07dd4636053b5593bc4976aa` |
| [257](https://github.com/tomer-mayara/Thermus/pull/257) | `9f07c04bba0813358274212b21316165dc3e308b` |

[PR255 merge proof](merge-255.json) and [PR257 merge proof](merge-257.json) confirm the tested trees and ancestry. No rebase or conflict resolution was needed for these final two merges. Each merged once through GitHub with its expected head SHA.

[PR255 live evidence](pr255/README.md) records hosted 29/29 and Public Connect 2/2. [PR257 live evidence](pr257/README.md) records hosted 29/29 in 8 suites. All three commands exited 0 with no failures, cancellations, skips or todos. Exact GET checks confirmed absence of all 101 recorded root resources across these commands. The [PR257 selection](pr257/selection-after-parent.md) explains why Public Connect was N/A after parent integration. Prior offline, quality and architecture evidence remains accepted at unchanged source heads; earlier failed or deferred attempts retain their original pins and limits. No source, assertion, deadline, retry or SDK change was needed for the successful live commands.

[Final Render readback](deployment-final-hold.json) confirms Auto-Deploy `no`, trigger `off`, previews off and unchanged live production `8c6d204e8588a664438ba8934ab36670b802525f`. The deployment hold remains in place. No production release, database migration or notice publication occurred. The temporary task VM is stopped; the default VM and Docker context are unchanged. The primary R1 worktree is clean apart from the preserved user draft, and test ports are free.

The linked live-run summaries were captured before the final merge. Their eligible/not-yet-merged wording is historical; this final record supersedes that status without changing execution pins. User-confirmed architect approval and the explicit recording waiver remain resolved. This completes stack integration, not the separate production rollout.
