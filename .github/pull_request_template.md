## Description

<Problem and result in 2–3 sentences. Include any material behavior or delivery limit.>

<!-- For a stack, link the parent PR here. Remove optional sections that do not apply. -->

## Review

**<T0 / T1 / T2>** — <generated reason line: the Architecture line of the checker report; also name a reason outside the facts, such as a policy path>

Architecture facts (checker, candidate <short SHA> vs <merge base or stack parent> <short SHA>):
- <one bullet for each fact, copied from the checker report; "none" when no fact applies>

<details><summary>Declaration diffs</summary>

<unified diff of each changed declaration snapshot, from the checker report.
Remove this block when no declaration changed.>

</details>

Why (from `.pr-impact.json`): <architecture summary of the committed declaration>

Merge status: <eligible / blocked; pending required approval means blocked>.
Blockers and required decisions: <list or none>.
Required human approval: <current-candidate approval needed, with role, or none>.

### Architectural impact

<Optional short impact statement. For unchanged architecture, one sentence in Review
can replace both optional subsections. Full assessment is in Quality review.>

### Architecture comparison

<Required when the checker reports fact a, b, c, or e, or an architect flag is true; useful
in other tiers when needed. For fact d alone, the declaration diffs above and the behavior
notes are enough; no drawing is required.
Name the comparison base/stack parent. Add focused L3 comparison with its named L2 boundary, then
3–4 short before/after behavior notes. Keep material authority, failure, order,
recovery, and delivery limits here. Omit this section when architecture is unchanged.>

---
Candidate: [<short SHA>](<commit URL>) · [Validation](<comment URL>) · [Quality review](<comment URL>)
