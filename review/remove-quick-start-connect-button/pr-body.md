## Description

Quick start's first step repeats the Connect link already present in the workspace menu. Remove the **Open Connect setup** action and its unused private renderer argument. The main Connect menu and copied Markdown guide retain their links. The live signup proof now follows Workspace → Connect, and the specification and test inventory describe that path.

## Review

**T0 Auto merge** — **T0: no architecture fact**. This is a private UI change; no protected policy, client-contract, deployment, data, or dependency path changes.

Architecture facts (checker, candidate `3e5931a0` vs main `7e9cc19a`):

- None. All 53 public-module declaration snapshots are unchanged.

Why (from `.pr-impact.json`): all classification flags are false and `modelUpdated` is false. Removing one redundant page link changes no route, access rule, public callable contract, component responsibility, dependency, or deployment. The registry prose and all 20 Mermaid views still describe the system. No comparison drawing or L4 detail is needed. The generated metric record preserves the merge-base analysis.

Merge status: **merged** as [cc2ed669](https://github.com/tomer-mayara/Thermus/commit/cc2ed669d6821525e23c6ff3d6ddcdc6339862bd). Blockers and required decisions: none. Required human approval: **none for T0**. The manager reviewed the complete candidate and retained findings; the checker alone does not establish completed release checks.

Validation covers the ordinary suite, type checks, portal build, focused browser checks, container and hosted builds, and the live signup/removal flow. Full results, retries, coverage provenance, and quality dispositions are in the maintained comments below.

Production: **live** on that revision; health and functional smoke checks passed. [Deployment evidence](./deployment/README.md).

---
Candidate: [3e5931a0](https://github.com/tomer-mayara/Thermus/commit/3e5931a080c88e0331cdd27cc036b37efbd8d80c) · [Validation](https://github.com/tomer-mayara/Thermus/pull/290#issuecomment-6481693931) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/290#issuecomment-6481694261)
