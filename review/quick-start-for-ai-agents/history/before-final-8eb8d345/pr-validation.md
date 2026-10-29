## Validation

Candidate: [{{HEAD}}](https://github.com/tomer-mayara/Thermus/commit/{{HEAD}}).
Trusted main merge base:
[`21458b0d18cc4f9efd3a59f6361a86f1acdc317c`](https://github.com/tomer-mayara/Thermus/commit/21458b0d18cc4f9efd3a59f6361a86f1acdc317c).
Interim source candidate: `b0ec502e8a7362bd03d82012b80362f7960c4430`.
The final SHA remains pending the generated immutable base metric record.
Bind source, build, and coverage evidence to the completed candidate before Ready.

Selection: a web source change selects the full ordinary suite, typecheck,
portal build, self-hosted container, hosted offline build, and Linux AMD64 hosted
image gate. Focused content/page/copy/acceptance and existing browser cases
provide exact-text and reflow evidence. Results below come only from this
candidate's new logs; earlier copy candidates are not reused as passes.

| Check | Current result | Evidence |
| --- | --- | --- |
| Focused source content/page/copy and composed acceptance cases | Pass: 14/14; zero failure, cancellation, skip, or todo | [log](./focused.log), [notes](./validation-notes.md) |
| Existing Quick start Chromium runtime | Pass: 2/2, JavaScript on/off; zero failure, cancellation, skip, or todo | [log](./browser.log), [screenshots](./ui/quick-start-390.png) |
| `npm test` | Pass, exit 0: 5,685 Node tests and 60 portal tests; zero failure, cancellation, skip, or todo in each part | [JSON](./npm-test.json), [log](./npm-test.log) |
| `npm run typecheck` | Pass, exit 0 | [JSON](./typecheck.json), [log](./typecheck.log) |
| `npm run build:user-portal` | Pass, exit 0 | [JSON](./portal-build.json), [log](./portal-build.log) |
| `npm run test:container` | Pass, exit 0: 11/11; zero failure, cancellation, skip, or todo | [JSON](./environment-gates/01-self-hosted-container.json), [log](./environment-gates/01-self-hosted-container.log) |
| `npm run build:hosted` | Pass, exit 0: groups 3,693 + 39 + 21 + 1,219 + 189 + 13, totaling 5,174 emitted tests; all pass with zero failure/cancellation/skip/todo. Groups are not a unique-scenario count. | [JSON](./environment-gates/02-build-hosted.json), [log](./environment-gates/02-build-hosted.log) |
| `npm run test:container:hosted` | Pending; the required final image must run Linux AMD64 | {{AMD64_RESULT_AND_EVIDENCE}} |
| Compatible coverage, final process/review/CRAP, habit-hooks, declaration verification, and committed-candidate checker | Pending; results and dispositions belong in Quality review | {{QUALITY_RESULTS_AND_EVIDENCE}} |

The focused checks ran from source with Node's transform-types option and no
new tests. The browser loaded built portal assets and checked the longer heading
at 320px, 390px, and 1024px, closed and expanded, with keyboard use and no
horizontal overflow or console/CSP/script errors. The 390px and 1024px images
were inspected. Controlled clipboard outcomes verify truthful status/manual
selection; they do not establish native host clipboard permission. Manual
readback confirms the exact requested title and paragraph, the retained copied
heading suffix, and canonical paragraph equality after line-wrap normalization.
See [manual checks](./manual-check.log) and
[content inspection](./content-inspection.json).

### Provenance, selection limits, and history

The ordinary suite started on base HEAD with the frozen source/guide overlay.
[Source freeze](./source-freeze.json) pins shared content SHA-256
`e90e4ec93542c04ef770409faa84c54a1f350e57619b8972c5688d30f2e28ab9` and guide
`0c3220c3e928bf32f996711b6fe399c0a1e4c6810ab049b7efe67512a500ea1b`.
Native gates used an isolated checkout with this same source overlay; retain
the [before](./environment-gates/native-provenance-before.json),
[final](./environment-gates/native-provenance-final.json), and
[overlay](./environment-gates/native-original-overlay.patch).
Node is v24.20.0. No source/test/build input changed during these completed
checks. The manager must reconcile those hashes and the final generated-record
commit with `{{HEAD}}`; a new runtime change would require refreshed evidence.

Coverage: unit + integration capture is in progress. Final report identity,
selected suites, source/build fingerprint compatibility, and accepted capture
provenance: {{FINAL_COVERAGE_PROVENANCE}}. No result is claimed from an unfinished
or rejected capture. The source selection permits both complete unit parts and
the selected integration suite; coverage cannot select unrelated suites.

Local tooling recovery: the initial base snapshot command exited 0, but its
wrapper reused the data path for exit metadata and overwrote the snapshot.
The manager retained [initial metadata](./snapshot-base-command.initial.json)
and reran the snapshot with distinct metadata/data paths; that command exited 0
and produced the actual [base snapshot](./snapshot-base.json).
See [rerun metadata](./snapshot-base-command.json) and
[log](./snapshot-base-command.log). This was tooling-data
recovery, not a failed or retried test. No test failure or retry has occurred
in the completed runs so far; preserve any later history if a remaining run
fails. Unfinished runs are not passes.

N/A: hosted-live, because no authentication/WorkOS behavior or live helper
changes. Whole Members browser, separate renderer/Brave, SQL, Collector, and
Render-interface gates are also N/A: their listed behavior and consuming
tests/support are unchanged. No separate `npm run check` is added; the ordinary
source checks cover its stages, while selected `build:hosted` keeps its nested
checks. This is not a self-hosted evaluation-image release or image-runtime
cutover, so their separate release command sets are not added.

The separately requested HTML artifact has before/after and manual evidence
under [artifact records](./artifact/change.patch); it is not a
repository or deployed-app substitute. Historical screenshots were not edited.
Authorized deployment follows merge through the existing Render Git service.
Deployment ID/merged SHA, public health, and public access behavior are pending
operational readback, not a current deployment claim. The existing production
browser session displayed Access denied for Quick start and offered only one
already-selected organization. No role, membership, credential, or selection
changed, and the temporary tab was closed. Positive production Admin UI and
native clipboard behavior are unverified; no permission change or bypass is
part of this verification. Fresh local Admin tests/screenshots and canonical
copy checks establish the available positive UI evidence. Retain this
[material access limit](./browser-access-limit.md) with the final
deployed-revision and public readback results. The authorization boundary remains
in force; verification does not require a positive production Admin view.

Previous versions and final execution/deployment history: {{VERSIONED_HISTORY_URLS}}.
Keep this one maintained Validation comment; replace pending fields only with
actual new evidence and retain the audit history when the candidate changes.
