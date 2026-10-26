# Exact-head approval and merge receipt

The owner explicitly approved [Thermus PR 260](https://github.com/tomer-mayara/Thermus/pull/260)
at head `2c7b8763025660d3fe3902af7a8433d2741fcb82` and authorized merge and
deploy. [Owner approval](owner-candidate-approval.json) retains the recorded
question, direct answer, exact candidate, role and authorized scope. This is
separate from earlier exact-byte approval of the notice package.

A read-only GitHub connector read confirms the PR is closed and merged, with
that approved head, merge `c9da79e63406e71dd15032d4ab9dfb85f2766918`, and
merge time **2026-10-26T17:27:25Z**. The
[verified receipt](merge-receipt.json) also records that the fetched merge tree
is byte-identical to the approved candidate tree; their diff is empty.

The exact-commit Render deployment started at **2026-10-26T17:33:43Z** and was
building at the manager handoff. This receipt does not claim that deployment is
live, that production behavior passed, or that Slice 2.5 is complete. Production
verification and final closeout remain pending a later evidence handoff. No
production configuration, access setting, PR report or root tracked file was
changed by this evidence append. Provider deployment IDs remain private.

[Earlier complete application evidence](../README.md) and all Marketing and
root report blobs remain unchanged. This additive record supplies later approval
and merge facts without rewriting historical preparation statements.
[File manifest](artifact-manifest.json) and [scan record](secret-scan.json)
identify the sanitized published records. Only selected approval fields and
verified merge facts are published; no private task state or runtime file is
included.
