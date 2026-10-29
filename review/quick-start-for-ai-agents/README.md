# PR #292 review evidence

Candidate: `8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0`.
Trusted base: `21458b0d18cc4f9efd3a59f6361a86f1acdc317c`.
Source/capture candidate: `b0ec502e8a7362bd03d82012b80362f7960c4430`.

**T0 Auto merge; eligible.** All selected checks passed, and the manager reviewed the complete candidate. The Linux AMD64 image gate passed 7/7 on one unchanged retry after a timing failure in an existing authentication test. Both attempts and the original failure remain retained. No source, deadline, assertion, guard, or test changed for the retry. All temporary validation checkouts are archived.

- [Main report](pr-body.md)
- [Validation](pr-validation.md)
- [Quality review](pr-quality.md)
- [Final manager sign-off](manager-review.md)
- [Independent review](independent-review.md)
- [Final input binding](final-input-binding.json)
- [Image gate summary](environment-gates/03-hosted-container-summary.md)
- [First failure](environment-gates/attempt-1/03-hosted-container-failure.md)
- [Prior manager hold](manager-review-initial.md)
- [Earlier drafts](history/README.md)

The source and copied guide use the exact approved wording. The external HTML mockup has separate evidence under `artifact/`; fresh screenshots are in `ui/`. Coverage retains its original verified capture identity, with compatibility checked at the final head. The final commit adds only the generated immutable base metric record. Full metric reports retain the unchanged MI goal miss and its documented reason; Review, CRAP, and Architecture pass.

This branch retains review evidence without changing the product candidate. The manifest records the exact published file hashes. Published comments point to an immutable evidence commit; local report sources use `{{EVIDENCE_BASE}}`.

Deployment follows merge through the existing Render Git service. Verification will bind the exact merged revision and public health/access checks. The current browser cannot access the production Admin guide, so positive UI proof comes from the fresh local Admin tests and screenshots. See the [access limit](browser-access-limit.md). No permission change is required.
