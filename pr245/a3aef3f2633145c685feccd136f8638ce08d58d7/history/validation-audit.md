# Validation history and evidence limits

Final source `a3aef3f2633145c685feccd136f8638ce08d58d7` against `7d01d2fb61c1ee0faebd1a1b78819902f832f5f4`. This summary preserves chronology; none of the failures below is relabelled a final passing result.

- Historical PR240 hosted run failed before its retry at the same ancestor head.
- Historical PR245 before fixture cleanup had PostgreSQL startup and container disk-space failures. Scoped disposable fixture cleanup added `docker rm -f --volumes`; attribution did not prove anonymous volumes were the sole ENOSPC cause. Later runtime runs passed.
- Earlier integration coverage/process attempt used stale coverage. New unit/integration capture at 1e6077ce is verified and reused by final process only under exact compatible inputs.
- Earlier quality check exposed projection MI precision: measured 36.99712939607105 displays 37.0; the existing exception bound is 36.9, with ownership reason and expiry. This does not lower the global MI goal.
- The initial current-main four-stage process generated a missing immutable metrics history record. Its checker correctly refused a dirty/uncommitted candidate; record was committed without editing, then final metrics/checker ran at this head.
- The successful final checker initially passed through a wrapper that combined allowed declaration diagnostic stderr with stdout JSON. That wrapper could not parse the mixed stream. The checker-only rerun split streams, exited 0, and pure tier.json pins this final head with no blockers. The separate diagnostic is preserved in quality/checker-diagnostic.md. The original combined-output log remains local and is not necessary as a second full checker report.
- The defined redaction repair has real failing public AuditLog/unit specifications followed by 59 focused/282 affected passes. Intermediate 54/277 and other earlier runs are revision-specific history. Richer/deeper/incomplete syntax can still lose public syntax with truncated:false; no arbitrary-secret/parser/latency claim is made.

Raw generic test/build/Docker/provider logs remain in the local retained source folders and prior index history; they are not uploaded in this explicit report bundle. Shared full metrics/static-review outputs, compact command/status records, source hashes and scoped runtime/coverage proofs give the reviewer the report evidence without environment/service output. Historical full reports under history remain clearly scoped to their earlier head/base, never current proof. Source and artifact commit pins are distinct.
