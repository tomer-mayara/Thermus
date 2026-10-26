# PR 251 merge validation selection

Reviewed candidate: `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d`.
Base: `8c6d204e8588a664438ba8934ab36670b802525f`.
Docker context: `colima-thermus-s25-merge`.

This is the complete source candidate, plus the reviewed correction to the second hosted PostgreSQL storage failure fixture. The source changes and all changed ordinary/live files match the prior selection in `.cache/pr251-rebase-8c6d204e/validation/selection.md`; its explicit eleven-file focused selection is retained in the fresh runner. Source selection requires the full ordinary suite, types, portal, WorkOS staging, native container, hosted AMD64 image, PostgreSQL and Collector gates. No extra `npm run check`, separate interface group or standalone offline hosted build is selected. Hosted image output must show a fresh successful `RUN --network=none npm run build:hosted` layer; cached execution does not prove this gate.

The fixed PostgreSQL focused file and complete group already passed in this task's owned Docker profile, before the candidate commit. `postgres-input-binding.json` records their actual pre-commit status and unchanged runtime/build inputs. It retains original logs, hashes and timestamp limits. These runs are reused on matching inputs; they are not relabeled as post-commit runs.

The fresh serial runner records the reviewed base/head, tracked hashes, runtime/build input list and fingerprint, runner/wrapper/launcher/Lightpanda hashes, exact child command, start/end, exit/signal, summary counts, log hashes and full Docker build streams. It rejects changed runtime inputs or changed head. Axiom settings are added only to the ordinary child environment from the existing local config; WorkOS staging uses the configured Keychain launcher. No secret values are written by the runner. Reports must be checked before external publication.

Run: `node .cache/s25-merge-20261026/pr251/validation/run-gates.mjs`.
An explicit resumed range uses the same command with the first and last step names. A failure stops the sequence for review. The candidate pin is in `candidate-pin.json`. The task-owned Docker profile remains available for later stack gates. The manager owns metrics, review eligibility, evidence publication and commit.
