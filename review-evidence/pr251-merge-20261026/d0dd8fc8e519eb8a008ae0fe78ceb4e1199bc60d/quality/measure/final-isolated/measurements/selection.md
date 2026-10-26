# PR251 isolated quality selection

Candidate: `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d`.
Actual base and complete-candidate main: `8c6d204e8588a664438ba8934ab36670b802525f`.

The manager authorizes fresh unit-only coverage in the isolated checkout.
The complete candidate changes src, so both complete unit parts are selected
under source rule 1. Prior unit-only capture covered all 17 required functions;
that old capture is stale after the runtime-test fix. Integration/acceptance,
container, hosted and live gate execution belong to the validation worker in
c617. This isolated quality run selects no live or container gate.

Run pinned Node 24.20.0, frozen pnpm install, unit-only measured coverage,
base/head snapshots, complete process, standalone CRAP, impact stamping and
tier checker. Reuse the separately current c617 Habit source/finding proof.
Keep the original checkout path and capture identity in every artifact.
