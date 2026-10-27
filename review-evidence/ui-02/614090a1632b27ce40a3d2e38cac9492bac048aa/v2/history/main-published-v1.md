## Description

Member rows previously mixed identity, role and prominent initial removal actions. UI-02 aligns labelled Member, Role and Action facts, keeps the active-row heading count separate from product-access seats, and uses quiet native Remove…/Leave… disclosures. Trusted subject identity selects You and Leave; only the final removal confirmation is red.

Existing protected forms, refusal/recovery outcomes, retained account/other-workspace access and approved help remain intact.

Stacked on [UI-01 #263](https://github.com/tomer-mayara/Thermus/pull/263) at `37046bbd`, in UI-01 → UI-02 → UI-03 → UI-04 order. No merge or deployment is claimed.

The source stack is [published](https://github.com/tomer-mayara/Thermus/blob/555ae4b96b1333ac952416307a41237640a72417/review-evidence/ui-02/614090a1632b27ce40a3d2e38cac9492bac048aa/v1/review/source-stack-push.json); UI-03 now targets UI-02. No merge or deployment occurred.

## Review

**T1 Team review**  
Architecture: T0: no architecture fact
The sole tier reason is trusted `read_paths` for `docs/implementation/test-gate-policy.md`; the browser inventory changes no gate command, selection or authority.

**Architecture facts** (`614090a1` against parent/merge base `37046bbd`):

- None.

The committed `.pr-impact.json` sets all classification flags false. Production architecture is unchanged within Web: the same complete overview and checked removal operation retain authority, protected fields, counts, provider behavior and lifetimes. No new public declaration, component, dependency, store or deployment boundary is introduced.

Native ordinary, browser, build, self-hosted and hosted-offline passes retain their original 82788735 pin through verified input mapping. Broad typecheck and quality are fresh at 614090a1. Metrics and habit findings have retained reasons; required function goals pass without exceptions.

**Overall merge status: blocked; Draft.** Hosted-live remains failed (six quota cases and a separate unexplained reinvitation 503). Linux AMD64 image proof is deferred to a dedicated local VM. Current-head independent human approval and final gate verification remain pending. Root accepted unchanged source and quality reasons against byte-identical findings; manager text review is accepted subject to gate-result updates; root records post-write readback separately. Local checker eligibility does not resolve those holds. [Evidence](https://github.com/tomer-mayara/Thermus/blob/555ae4b96b1333ac952416307a41237640a72417/review-evidence/ui-02/614090a1632b27ce40a3d2e38cac9492bac048aa/v1/README.md).

---
Candidate: [614090a1](https://github.com/tomer-mayara/Thermus/commit/614090a1632b27ce40a3d2e38cac9492bac048aa) · [Validation](https://github.com/tomer-mayara/Thermus/pull/264#issuecomment-6427827431) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/264#issuecomment-6427827759)
