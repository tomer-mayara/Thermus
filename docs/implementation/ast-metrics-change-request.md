# Change request: the ast-metrics review process and architecture evolution views

| Field | Value |
| --- | --- |
| Repository | `tomer-mayara/Thermus` |
| Baseline | `main` at `7c302fa5`, after pull requests #170 and #172 |
| Owner | Tomer Mayara; reviews decisions and merges |
| Status | Proposed, revision 4, 2026-10-18; draft under review |
| Scope | Revise the proposal. This document does not implement a command or change a policy. |

This revision updates the supplied revision 3 proposal to the current repository.
The six commands now live under `script/code-quality/`. The previous refactor
grouped their helpers and removed the duplicate risk calculation.

The current [test gate policy](test-gate-policy.md) controls test selection.
Script changes do not select broad product suites by themselves. Coverage runs
and live tests that start coverage follow the same selection limit.

The full revision will retain CR-01 to CR-24, correct the provenance and CRAP
contracts, and keep owner decisions open. The existing
[review guide](ast-metrics-review.md) remains the current process until the
individual changes land.
