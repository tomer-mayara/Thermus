# Slice 2.5 integration progress

The first three PRs merged in order. Automatic deployment is off in Thermus AI. Production remains at 8c6d204e8588a664438ba8934ab36670b802525f.

| PR | Reviewed head | Main merge commit | Reviewed and merged tree |
| --- | --- | --- | --- |
| #251 | d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d | 3d271bbae20b3d2ed91751fb77c10f6ead4bed99 | d703454ee49533db2f2da7730ab77dde65778b6b |
| #253 | b630a76275d5809a498ae63e1cbc322086f4194f | 0c9bfbda706397d4df8834f1d9d441a394f051ae | 648e30fca690a7df2871b19e1defc6a09b954718 |
| #254 | ddad19589a13e40b1aea516b2e5e3b90ea3aec70 | e61da534d428169936e80f2bdaebe081c902aee0 | c9528ca016831afd36052f98b3a8b50be95b6e1a |

Each merge tree equals the reviewed candidate tree. PR253 and PR254 kept their reviewed merge bases, so source, policy, test inputs and quality comparisons did not change. Original tests keep their actual execution SHAs; no test was relabeled as a run on a merge commit.

The user confirmed architect approval and explicitly waived the recording step. No reviewer name or GitHub review is asserted.

PR255 now targets main at e61da534d428169936e80f2bdaebe081c902aee0. Its merge base remains ddad19589a13e40b1aea516b2e5e3b90ea3aec70; all 27 changed paths are outside src/. The documented source-free test selection is now confirmed after parent integration. Required live verification remains incomplete. PR257 still targets PR255 and remains blocked by its required live groups.

A focused diagnostic at e46c5068 failed during setup when WorkOS createUser returned HTTP 502. Its three invitation cases were cancelled before their bodies. It was not a required gate run and did not explain the earlier browser timeouts. All temporary compiled changes were restored. All nine journaled resources returned 404 in exact-ID readback; unknown IDs from a lost create response are outside that proof.

Keep automatic deployment off until the remaining validation and separate release gates are complete. No production database, notice or removal rollout was performed.
